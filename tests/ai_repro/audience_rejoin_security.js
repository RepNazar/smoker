const assert = require('node:assert/strict');
const { io } = require('../../node_modules/socket.io/client-dist/socket.io.js');
const { startServer } = require('./lib/server');
const game = require('../../games/season2_kinohardkor_2_0.json');

async function main() {
  const server = await startServer();
  const sockets = [];
  const connect = async () => {
    const socket = io(server.url, { transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    socket.events = [];
    socket.onAny((event, data) => socket.events.push({ event, data }));
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    return socket;
  };
  const emit = (socket, event, data) => new Promise((resolve, reject) => {
    socket.timeout(3000).emit(event, data, (error, result) => error ? reject(error) : resolve(result));
  });
  const ok = async (socket, event, data) => {
    const result = await emit(socket, event, data);
    assert.equal(result.ok, true, `${event}: ${JSON.stringify(result)}`);
    return result;
  };
  const waitFor = async predicate => {
    const deadline = Date.now() + 3000;
    while (!predicate()) {
      assert.ok(Date.now() < deadline, 'expected socket event did not arrive');
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };
  try {
    const host = await connect();
    const { code } = await ok(host, 'createRoom', { hostToken: 'audience-security-test', gameId: 'season2-kinohardkor-2' });
    await ok(host, 'openAudienceRound', { code, roundIndex: 0 });
    const winner = await connect();
    const identity = await ok(winner, 'joinAudience', { code, name: 'Winner' });
    assert.match(identity.audienceKey, /^[a-f0-9]{32}$/);
    const attacker = await connect();
    const other = await ok(attacker, 'joinAudience', { code, name: 'Other', audienceId: identity.audienceId });
    assert.notEqual(other.audienceId, identity.audienceId, 'public ID must not authenticate in lobby');
    assert.notEqual(other.audienceKey, identity.audienceKey);
    for (const question of game.audienceRounds[0].questions) {
      await ok(host, 'startAudienceQuestion', { code });
      assert.equal((await emit(attacker, 'joinAudience', { code, audienceId: identity.audienceId })).ok, false);
      assert.equal((await emit(attacker, 'joinAudience', { code, audienceKey: 'wrong-key' })).ok, false);
      await ok(winner, 'submitAudienceAnswer', { code, option: question.correct });
      await ok(host, 'finishAudienceQuestion', { code });
    }
    await ok(host, 'finishAudienceRound', { code });
    await waitFor(() => host.events.some(x => x.event === 'hostSecrets' && x.data.audienceWinner));
    const hostSecrets = host.events.filter(x => x.event === 'hostSecrets').at(-1).data;
    assert.equal(hostSecrets.audienceWinner.id, identity.audienceId);
    const prize = hostSecrets.audienceWinner.code;
    assert.match(prize, /^[A-F0-9]{6}$/);
    assert.equal((await emit(attacker, 'joinAudience', { code, name: 'Winner', audienceId: identity.audienceId })).ok, false);
    assert.equal((await emit(attacker, 'joinAudience', { code, audienceKey: identity.audienceId })).ok, false);
    const own = await ok(attacker, 'joinAudience', { code, audienceKey: other.audienceKey });
    assert.equal(own.prizeCode, '');
    winner.disconnect();
    const restored = await connect();
    const rejoined = await ok(restored, 'joinAudience', { code, audienceKey: identity.audienceKey });
    assert.equal(rejoined.audienceId, identity.audienceId);
    assert.equal(rejoined.audienceKey, identity.audienceKey);
    assert.equal(rejoined.prizeCode, prize, 'winner must recover the same prize after reconnect');
    await ok(host, 'revealNextAudience', { code });
    await waitFor(() => [attacker, restored].every(socket => socket.events.some(x => x.event === 'state' && x.data.audience?.winner)));
    for (const socket of [attacker, restored]) {
      const publicEvents = JSON.stringify(socket.events);
      assert.equal(publicEvents.includes(identity.audienceKey), false, 'secret key must not be broadcast');
      assert.equal(publicEvents.includes(other.audienceKey), false, 'other key must not be broadcast');
      assert.equal(publicEvents.includes(prize), false, 'prize must not be broadcast');
    }
    assert.equal(attacker.events.some(x => x.event === 'audiencePrize'), false);
    console.log('PASS: public-ID impersonation blocked; keys private; winner reconnect and HOST prize preserved.');
  } finally {
    for (const socket of sockets) socket.disconnect();
    server.stop();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
