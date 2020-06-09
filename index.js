// index.js - main module script of docker-auth
// Copyright (C) 2017-2020 Kaz Nishimura
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

const url = require("url");

/**
 * HTTP request builder.
 *
 * @param {(string | Object)} location resource location
 * @private
 */
class _RequestBuilder
{
    constructor(location)
    {
        if (typeof location === "string") {
            location = url.parse(location);
        }
        this.options = {
            protocol: location.protocol,
            hostname: location.hostname,
            port:     location.port,
            path:     location.pathname,

            method:   "GET",
            headers:  {
                "User-Agent": "docker-auth",
            },
        };
        this._queryString = location.search.replace(/^\?/, "");
    }

    /**
     * Sets the acceptable media types.
     *
     * @param {string} types acceptable media types
     * @return {_RequestBuilder} `this`
     */
    accept(types)
    {
        this._accept = types;
        return this;
    }

    /**
     * Builds a request.
     *
     * @return {http.ClientRequest} request
     */
    build()
    {
        let options = this.options;
        if (this._queryString != null) {
            options.path += "?" + this._queryString;
        }
        if (this._accept != null) {
            options.headers["Accept"] = this._accept;
        }

        const transport = require(
            options.protocol == "http:" ? "http" : "https");
        return transport.request(options);
    }
}
module.exports._RequestBuilder = _RequestBuilder;

/**
 * Makes a `GET` request for a JSON value.
 *
 * @param {(string | Object)} location resource location
 * @return {Promise} promise object to receive a JSON object
 * @private
 */
function _get(location)
{
    return new Promise((resolve, reject) => {
        let builder = new _RequestBuilder(location);
        builder.accept("application/json");

        let request = builder.build();
        request.on("error", (error) => {
            reject(error);
        }).on("response", (response) => {
            let content = "";
            response.on("data", (data) => {
                content = content + data;
            });
            response.on("end", () => {
                switch (response.statusCode) {
                case 200:
                case 401:
                case 404:
                    resolve(JSON.parse(content), response.statusCode);
                    break;
                default:
                    reject("Response: " + response.statusMessage);
                }
            });
        }).end();
    });
}
module.exports._get = _get;

/**
 * Requests an access token for a Docker Registry.
 *
 * @param {string} challenge as received from a Docker Registry
 * @param {{scope: ?string}} [options]
 * @return {Promise} promise object to receive an access token
 */
function requestToken(challenge, options)
{
    if (options == null) {
        options = {};
    }

    // tchar = [\w!#$%&'*+.^\\|~-]
    // token = [\w!#$%&'*+.^\\|~-]+
    // auth-param = [\w!#$%&'*+.^\\|~-]+\s*=\s*(?:[\w!#$%&'*+.^\\|~-]+|"[^"]*")
    const RE1 =
        /([\w!#$%&'*+.^\\|~-]+)(?:\s+((?:,|[\w!#$%&'*+.^\\|~-]+\s*=\s*(?:[\w!#$%&'*+.^\\|~-]+|"[^"]*"))(?:\s*,(?:\s*[\w!#$%&'*+.^\\|~-]+\s*=\s*(?:[\w!#$%&'*+.^\\|~-]+|"[^"]*"))?)*))?/g;
    const RE2 =
        /([\w!#$%&'*+.^\\|~-]+)\s*=\s*(?:([\w!#$%&'*+.^\\|~-]+)|"([^"]*)")/g;
    let m1;
    while ((m1 = RE1.exec(challenge)) != null) {
        let scheme = m1[1].toLowerCase();
        let params = {};
        let m2;
        while ((m2 = RE2.exec(m1[2])) != null) {
            params[m2[1].toLowerCase()] = m2[2] || m2[3];
        }
        if (scheme == "bearer" && "realm" in params && "service" in params) {
            let location = params["realm"] + "?service=" + params["service"];
            let scope = options.scope || params["scope"];
            if (scope != null) {
                location += "&scope=" + scope;
            }
            return _get(location);
        }
    }
    throw new Error("No supported scheme found");
}
module.exports.requestToken = requestToken;
