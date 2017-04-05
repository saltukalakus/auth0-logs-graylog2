# Auth0 - Logs to GrayLog2

This project is a simple Node.js application which will take all of your Auth0 logs and exports them to GrayLog2. 

For debug purposes you could also store to a local file if you enable FILELOG_ENABLE option.
Note that storing to file is not meant to be used in production because it won't scale well.
File log option stores in this path `./logs/auth0.logs` in the same folder where this application runs.

## Configure
* Install Node.js and Npm in your local environment if you haven't installed yet.

* Create a new client for your Logger as described [here](https://auth0.com/docs/api/management/v2/tokens#1-create-and-authorize-a-client).
Note that, inorder to receive logs from Auth0, you need to set `read:logs` scope for this client.

* In your GrayLog2 server create a new [HTTP GELF endpoint](http://docs.graylog.org/en/2.2/pages/sending_data.html#gelf-via-http). 

* Copy .env.example as .env in the same folder. Update the .env for your Auth0 Logger client created in the previous step.

    * <b>AUTH0_CLIENT_ID</b> : Your Auth0 Logger API client ID.
    * <b>AUTH0_CLIENT_SECRET</b> : Your Auth0 Logger API client secret.
    * <b>AUTH0_DOMAIN</b> : Your Auth0 account domain. YOUR_DOMAIN.auth0.com or YOUR_DOMAIN.(au|eu).auth0.com 
    * <b>BATCH_SIZE</b> : Batch size to request logs in single API call. Set to 100 which is the default value.
    * <b>START_FROM_ID</b> : Set the log _id to start logging from a specific point in time. If you want to start from the beginning set `null`. Once the log file is created, application resumes from the last log in the log file.
    * <b>POLLING_INTERVAL_IN_SEC</b> : Interval where log API is polled in seconds. Set something based on log creation speed, for most accounts 30 seconds should be enough.
    * <b>TRACK_THE_LATEST_IN_SEC</b> : When the logger reaches to the edge of the Auth0 logs, it makes extra delay before the next pass for Auth0 logs to be stabilised. Set this something like 600 seconds.
    * <b>FILTER_CLIENTS_WITH_ID</b> : Leave it blank if you want all clients in the logs. Otherwise add client IDs separated with comma. Check `.env.example` for a sample usage.
    * <b>GRAYLOG2_HOST</b> : Graylog2 server host name, E.g. 127.0.0.1 for HTTP Gelf endpoint.
    * <b>GRAYLOG2_PORT</b> : Graylog2 server port for HTTP Gelf endpoint.
    * <b>GRAYLOG2_META</b> : Optional static meta you may want to add for each log message.
    * <b>FILELOG_ENABLE</b> : Setting this to `false` disables file logging.

## Limitations
* Graylog2 Gelf Endpoint should be an HTTP endpoint not a HTTPS.
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
