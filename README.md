# Auth0 - Logs to Winston Transport

This project is a simple Node.js application which will take all of your Auth0 logs and exports them to enabled exports. Currently it supports following exports;

* FileLog => Stores in `./logs/auth0.logs` in the same folder where this application runs.
* GrayLog2 => Stores in GrayLog2 server.

## Configure
* Install Node.js and Npm in your local environment if you haven't installed yet.

* Create a new client for your Logger as described [here](https://auth0.com/docs/api/management/v2/tokens#1-create-and-authorize-a-client).
Note that, inorder to receive logs from Auth0, you need to set `read:logs` scope for this client.

* Copy .env.example as .env in the same folder. Update the .env for your Auth0 Logger client created in the previous step.

    * AUTH0_CLIENT_ID : Your Auth0 client ID for Logger.
    * AUTH0_CLIENT_SECRET : Your Auth0 client secret for Logger.
    * AUTH0_DOMAIN : Your Auth0 account domain. YOUR_DOMAIN.auth0.com or YOUR_DOMAIN.(au|eu).auth0.com 
    * BATCH_SIZE : Batch size to request logs in single API call. Set to 100 which is the default value.
    * START_FROM_ID : Set the log _id to start logging from a specific point in time. If you want to start from the beginning set `null`. Once the log file is created, application resumes from the last log in the log file.
    * POLLING_INTERVAL_IN_SEC : Interval where log API is polled in seconds.
    * TRACK_THE_LATEST_IN_SEC : When the logger reaches to the edge of the Auth0 logs, it makes extra delay before the next pass for Auth0 logs to be stabilised. Set this something like 600 seconds.
    * GRAYLOG2_HOST : Graylog2 server host name, E.g. 127.0.0.1
    * GRAYLOG2_PORT : Port for Graylog2 server.
    * GRAYLOG2_BUFFERSIZE : UDP packet size most of the time 1400 is OK.
    * GRAYLOG2_ENABLE : Setting this to `false` disables Graylog2 logging.
    * FILELOG_ENABLE : Setting this to `false` disables file logging.

## Limitations
* Currently for Graylog2 transport this project supports one host to configure. If you need to set multiple hosts, you need to pass the host array manually in the code.
* Last stored log's id is not retrieved from transport, so if you restart the app, it will start from the first available log in Auth0 if `START_FROM_ID` is set as null.
* You could use PM2 or Forever packages to run the application in production environments. However note that you need to run single instance per your different environment setup. This is basically because multiple instances will not cooperate and share the load but will try to push the same logs to the transport.

## Usage
```bash
   npm install
   npm start
```

## Issue Reporting

If you have found a bug or if you have a feature request, please report them at this repository issues section. Please do not report security vulnerabilities on the public GitHub issue tracker. The [Responsible Disclosure Program](https://auth0.com/whitehat) details the procedure for disclosing security issues.

## Author

[Auth0](auth0.com)

## What is Auth0?

Auth0 helps you to:

* Add authentication with [multiple authentication sources](https://docs.auth0.com/identityproviders), either social like **Google, Facebook, Microsoft Account, LinkedIn, GitHub, Twitter, Box, Salesforce, among others**, or enterprise identity systems like **Windows Azure AD, Google Apps, Active Directory, ADFS or any SAML Identity Provider**.
* Add authentication through more traditional **[username/password databases](https://docs.auth0.com/mysql-connection-tutorial)**.
* Add support for **[linking different user accounts](https://docs.auth0.com/link-accounts)** with the same user.
* Support for generating signed [Json Web Tokens](https://docs.auth0.com/jwt) to call your APIs and **flow the user identity** securely.
* Analytics of how, when and where users are logging in.
* Pull data from other sources and add it to the user profile, through [JavaScript rules](https://docs.auth0.com/rules).

## Create a free Auth0 Account

1. Go to [Auth0](https://auth0.com) and click Sign Up.
2. Use Google, GitHub or Microsoft Account to login.

## License

This project is licensed under the MIT license. See the [LICENSE](LICENSE) file for more info.
