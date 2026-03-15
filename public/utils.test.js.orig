import test from 'node:test';
import assert from 'node:assert';
import { formatTime, getWindDirection } from './utils.js';

test('formatTime utility function', async (t) => {
    await t.test('formats afternoon time correctly (13:00 -> 1:00PM)', () => {
        assert.strictEqual(formatTime('13:00'), '1:00PM');
    });

    await t.test('formats midnight correctly (00:00 -> 12:00AM)', () => {
        assert.strictEqual(formatTime('00:00'), '12:00AM');
    });

    await t.test('formats morning time correctly (09:45 -> 9:45AM)', () => {
        assert.strictEqual(formatTime('09:45'), '9:45AM');
    });

    await t.test('formats noon correctly (12:00 -> 12:00PM)', () => {
        assert.strictEqual(formatTime('12:00'), '12:00PM');
    });

    await t.test('returns empty string for null input', () => {
        assert.strictEqual(formatTime(null), '');
    });

    await t.test('returns empty string for undefined input', () => {
        assert.strictEqual(formatTime(undefined), '');
    });

    await t.test('returns empty string for empty string input', () => {
        assert.strictEqual(formatTime(''), '');
    });

    const malformedInputs = ['foo', '13', '13:', ':30', '1a:2b', '24:00', '13:60', '10:20:80', '10:20:60', '13:00:60'];
    for (const input of malformedInputs) {
        await t.test(`returns empty string for malformed input: ${input}`, () => {
            assert.strictEqual(formatTime(input), '');
        });
    }
});

test('formatTime utility function with seconds', async (t) => {
    await t.test('formats time with seconds correctly (13:00:45 -> 1:00PM)', () => {
        assert.strictEqual(formatTime('13:00:45'), '1:00PM');
    });
});

test('getWindDirection utility function', async (t) => {
    await t.test('returns correct cardinal directions', () => {
        assert.strictEqual(getWindDirection(0), 'N');
        assert.strictEqual(getWindDirection(90), 'E');
        assert.strictEqual(getWindDirection(180), 'S');
        assert.strictEqual(getWindDirection(270), 'W');
        assert.strictEqual(getWindDirection(360), 'N');
    });

    await t.test('returns correct intermediate directions', () => {
        assert.strictEqual(getWindDirection(45), 'NE');
        assert.strictEqual(getWindDirection(135), 'SE');
        assert.strictEqual(getWindDirection(225), 'SW');
        assert.strictEqual(getWindDirection(315), 'NW');
    });

    await t.test('handles degrees outside 0-360 range via modulo', () => {
        assert.strictEqual(getWindDirection(450), 'E'); // 450 % 360 = 90 -> E
        assert.strictEqual(getWindDirection(720), 'N'); // 720 % 360 = 0 -> N
    });

    await t.test('handles negative degrees', () => {
        assert.strictEqual(getWindDirection(-90), undefined); // Javascript array[-index] is undefined
    });

    await t.test('returns undefined for invalid inputs', () => {
        assert.strictEqual(getWindDirection(null), 'N'); // Number(null) is 0
        assert.strictEqual(getWindDirection(undefined), undefined);
        assert.strictEqual(getWindDirection('foo'), undefined);
    });
});
