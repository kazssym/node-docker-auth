// docker-auth/test.js
// Copyright (C) 2017-2018 Kaz Nishimura
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
// IN THE SOFTWARE.
//
// SPDX-License-Identifier: MIT

"use strict";

const assert = require("assert");
const auth = require(".");

const TEST_URL = "https://httpbin.org:443/get?q=test";

// RequestBuilder
let builder = new auth._RequestBuilder(TEST_URL);
assert.equal(builder.options.protocol, "https:");
assert.equal(builder.options.hostname, "httpbin.org");
assert.equal(builder.options.port, 443);
assert.equal(builder.options.path, "/get");
assert.equal(builder._queryString, "q=test");

let request = builder.build();
request.on("response", (response) => {
    let content = "";
    response.on("data", (data) => {
        content += data;
    }).on("end", () => {
        assert.equal(response.statusCode, 200);
    });
}).end();

// _get
auth._get(TEST_URL).then((value) => {
    assert.equal(value["args"]["q"], "test");
}).catch((reason) => {
    assert.fail(reason);
});

// requestToken
auth.requestToken(" Bearer realm=\"https://auth.docker.io/token\"" +
    ",service=\"registry.docker.io\"").then((value) => {
    assert.strictEqual(typeof value["token"], "string");
    assert.strictEqual(typeof value["access_token"], "string");
    assert.strictEqual(typeof value["issued_at"], "string");
    assert.strictEqual(typeof value["expires_in"], "number");
}).catch((reason) => {
    assert.fail(reason);
});
