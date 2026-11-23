// Integration tests for the HTTP layer. No database is needed: the models are
// stubbed where a test reaches a controller, and everything else is rejected by
// middleware before it would touch Mongo.
process.env.JWT_KEY = 'test-secret-key-that-is-long-enough'
process.env.FRONTEND_URL = 'http://localhost:4200'

const { test, describe, before, after, afterEach, mock } = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = require('../app')
const users = require('../models/userModel')

const USER_ID = '507f1f77bcf86cd799439011'
const sign = (payload = { userId: USER_ID }, secret = process.env.JWT_KEY, options = { algorithm: 'HS256', expiresIn: '1h' }) =>
    jwt.sign(payload, secret, options)
const auth = (token) => ({ Authorization: `Bearer ${token}` })

let server
let base

const call = async (method, path, { headers = {}, body } = {}) => {
    if (method === 'GET' || method === 'HEAD') body = undefined
    const res = await fetch(base + path, {
        method,
        headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
    })
    const text = await res.text()
    let json
    try { json = JSON.parse(text) } catch { json = undefined }
    return { status: res.status, headers: res.headers, json, text }
}

before(async () => {
    server = app.listen(0)
    await new Promise((resolve) => server.once('listening', resolve))
    base = `http://127.0.0.1:${server.address().port}`
})

after(() => server.close())
afterEach(() => mock.restoreAll())

const stubRole = (role) =>
    mock.method(users, 'findById', () => ({ select: async () => (role ? { role } : null) }))

describe('platform', () => {
    test('GET /health reports the database state', async () => {
        const res = await call('GET', '/health')
        assert.equal(res.status, 503)
        assert.equal(res.json.status, 'unavailable')
    })

    test('unknown routes return a JSON 404', async () => {
        const res = await call('GET', '/api/does-not-exist')
        assert.equal(res.status, 404)
        assert.ok(res.json.message)
    })

    test('malformed JSON returns 400, not 500', async () => {
        const res = await call('POST', '/api/login', { body: '{"email":' })
        assert.equal(res.status, 400)
    })

    test('CORS only allows the configured frontend origin', async () => {
        const allowed = await call('GET', '/health', { headers: { Origin: 'http://localhost:4200' } })
        assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:4200')

        const denied = await call('GET', '/health', { headers: { Origin: 'https://evil.example' } })
        assert.equal(denied.headers.get('access-control-allow-origin'), null)
    })
})

describe('authentication', () => {
    const adminRoutes = [
        ['GET', '/api/getAllUsers'],
        ['GET', '/api/getDownloadedRecipesList'],
        ['GET', '/api/getTestimony'],
        ['PATCH', `/api/updateTestimony/${USER_ID}`],
        ['POST', '/api/addRecipe'],
        ['PUT', `/api/updateRecipe/${USER_ID}`],
        ['DELETE', `/api/deleteRecipe/${USER_ID}`]
    ]

    for (const [method, path] of adminRoutes) {
        test(`${method} ${path} rejects anonymous callers`, async () => {
            const res = await call(method, path, { body: {} })
            assert.equal(res.status, 401)
        })

        test(`${method} ${path} rejects a bogus token`, async () => {
            const res = await call(method, path, { headers: auth('not-a-jwt'), body: {} })
            assert.equal(res.status, 401)
        })
    }

    test('user-only routes require a token', async () => {
        for (const [method, path] of [
            ['GET', '/api/getSavedRecipes'],
            ['POST', `/api/savedRecipe/${USER_ID}`],
            ['DELETE', `/api/deleteSavedRecipe/${USER_ID}`],
            ['POST', `/api/addDownload/${USER_ID}`],
            ['GET', '/api/getDownload'],
            ['DELETE', `/api/deleteDownload/${USER_ID}`],
            ['POST', '/api/addTestimony'],
            ['PATCH', '/api/updateProfile']
        ]) {
            const res = await call(method, path, { body: {} })
            assert.equal(res.status, 401, `${method} ${path}`)
        }
    })

    test('rejects tokens signed with the wrong secret', async () => {
        const res = await call('GET', '/api/getAllUsers', { headers: auth(sign({ userId: USER_ID }, 'another-secret')) })
        assert.equal(res.status, 401)
    })

    test('rejects expired tokens', async () => {
        const expired = sign({ userId: USER_ID }, process.env.JWT_KEY, { algorithm: 'HS256', expiresIn: -10 })
        const res = await call('GET', '/api/getAllUsers', { headers: auth(expired) })
        assert.equal(res.status, 401)
    })

    test('rejects unsigned (alg: none) tokens', async () => {
        const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
        const forged = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ userId: USER_ID, role: 'Admin' })}.`
        const res = await call('GET', '/api/getAllUsers', { headers: auth(forged) })
        assert.equal(res.status, 401)
    })

    test('a valid token for a non-admin is forbidden on admin routes', async () => {
        stubRole('User')
        const res = await call('POST', '/api/addRecipe', { headers: auth(sign()), body: {} })
        assert.equal(res.status, 403)
    })

    test('the role is re-checked in the database, so a token claiming Admin is not enough', async () => {
        stubRole('User')
        const token = sign({ userId: USER_ID, role: 'Admin' })
        const res = await call('GET', '/api/getAllUsers', { headers: auth(token) })
        assert.equal(res.status, 403)
    })

    test('a token for a deleted user is forbidden on admin routes', async () => {
        stubRole(null)
        const res = await call('GET', '/api/getAllUsers', { headers: auth(sign()) })
        assert.equal(res.status, 403)
    })

    test('admins can reach admin routes and password hashes are never returned', async () => {
        stubRole('Admin')
        mock.method(users, 'find', () => ({
            select: async () => [new users({ username: 'a', email: 'a@example.com', password: 'secret-hash' })]
        }))
        const res = await call('GET', '/api/getAllUsers', { headers: auth(sign()) })
        assert.equal(res.status, 200)
        assert.equal(res.json.length, 1)
        assert.ok(!('password' in res.json[0]))
    })

    test('a legacy lowercase "admin" role is treated as Admin', async () => {
        const legacy = new users({ username: 'a', email: 'a@example.com', password: 'x', role: 'admin' })
        assert.equal(legacy.role, 'Admin')
        assert.ok(!('password' in legacy.toJSON()))
    })
})

describe('login', () => {
    let hash
    before(async () => { hash = await bcrypt.hash('correct-horse', 4) })

    const stubUser = (password) =>
        mock.method(users, 'findOne', () => ({
            select: async () =>
                password === null
                    ? null
                    : new users({ _id: USER_ID, username: 'chef', email: 'chef@example.com', password })
        }))

    test('succeeds with the right password, returns an expiring token and no hash', async () => {
        stubUser(hash)
        const res = await call('POST', '/api/login', { body: { email: 'chef@example.com', password: 'correct-horse' } })
        assert.equal(res.status, 200)
        assert.ok(!('password' in res.json.user))
        assert.ok(!res.text.includes(hash))
        const decoded = jwt.verify(res.json.token, process.env.JWT_KEY)
        assert.ok(decoded.exp, 'token must expire')
        assert.equal(decoded.userId, USER_ID)
        assert.equal(res.json.user.role, 'User')
    })

    test('wrong password and unknown email give the same generic 401', async () => {
        stubUser(hash)
        const wrong = await call('POST', '/api/login', { body: { email: 'chef@example.com', password: 'nope' } })
        mock.restoreAll()
        stubUser(null)
        const unknown = await call('POST', '/api/login', { body: { email: 'ghost@example.com', password: 'nope' } })

        assert.equal(wrong.status, 401)
        assert.equal(unknown.status, 401)
        assert.deepEqual(wrong.json, unknown.json)
    })

    test('does NOT accept a plaintext password stored in the database', async () => {
        stubUser('plain-text-password')
        const res = await call('POST', '/api/login', { body: { email: 'chef@example.com', password: 'plain-text-password' } })
        assert.equal(res.status, 401)
    })

    test('rejects NoSQL operator objects before querying', async () => {
        const findOne = mock.method(users, 'findOne', () => { throw new Error('must not query') })
        const res = await call('POST', '/api/login', { body: { email: { $ne: null }, password: 'x' } })
        assert.equal(res.status, 400)
        assert.equal(findOne.mock.callCount(), 0)
    })
})

describe('input validation', () => {
    test('registration rejects short passwords, bad emails and object payloads', async () => {
        const create = mock.method(users, 'create', () => { throw new Error('must not create') })
        for (const body of [
            { username: 'a', email: 'a@example.com', password: 'short' },
            { username: 'a', email: 'not-an-email', password: 'long-enough-1' },
            { username: 'a', email: { $ne: null }, password: 'long-enough-1' },
            { username: '', email: 'a@example.com', password: 'long-enough-1' }
        ]) {
            const res = await call('POST', '/api/registration', { body })
            assert.equal(res.status, 400, JSON.stringify(body))
            assert.ok(res.json.message)
        }
        assert.equal(create.mock.callCount(), 0)
    })

    test('registration never trusts a client-supplied role', async () => {
        mock.method(users, 'findOne', async () => null)
        const create = mock.method(users, 'create', async (doc) => new users(doc))
        const res = await call('POST', '/api/registration', {
            body: { username: 'sneaky', email: 'sneaky@example.com', password: 'long-enough-1', role: 'Admin' }
        })
        assert.equal(res.status, 201)
        assert.equal(create.mock.calls[0].arguments[0].role, undefined)
        assert.equal(res.json.user.role, 'User')
        assert.ok(!('password' in res.json.user))
    })

    test('registration reports duplicates as 409', async () => {
        mock.method(users, 'findOne', async () => ({ _id: USER_ID }))
        const res = await call('POST', '/api/registration', {
            body: { username: 'a', email: 'a@example.com', password: 'long-enough-1' }
        })
        assert.equal(res.status, 409)
    })

    test('malformed ids are rejected with 400', async () => {
        assert.equal((await call('GET', '/api/viewRecipe/123')).status, 400)
        stubRole('Admin')
        assert.equal((await call('DELETE', '/api/deleteRecipe/not-an-id', { headers: auth(sign()) })).status, 400)
    })

    test('related recipes need a string cuisine', async () => {
        assert.equal((await call('GET', '/api/relatedRecipe')).status, 400)
        assert.equal((await call('GET', '/api/relatedRecipe?cuisine[$ne]=x')).status, 400)
    })

    test('addRecipe validates the payload', async () => {
        stubRole('Admin')
        const res = await call('POST', '/api/addRecipe', { headers: auth(sign()), body: { name: 'Soup' } })
        assert.equal(res.status, 400)
        assert.ok(Array.isArray(res.json.errors) && res.json.errors.length > 1)
    })

    test('updateTestimony only accepts known statuses', async () => {
        stubRole('Admin')
        const res = await call('PATCH', `/api/updateTestimony/${USER_ID}`, {
            headers: auth(sign()),
            body: { status: 'Whatever' }
        })
        assert.equal(res.status, 400)
    })
})
