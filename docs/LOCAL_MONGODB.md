# Install and run MongoDB locally

Saunaman uses MongoDB Community Server for its local database. MongoDB Shell (`mongosh`) lets you check the connection. Install both, start the server, and then start the app. The current booking locks work with a standalone MongoDB server.

## macOS

### Install

1. Install Homebrew using the instructions at https://brew.sh if `brew --version` does not work. Follow its terminal instructions to add Homebrew to your PATH, then open a new terminal.
2. Choose a MongoDB version supported by your macOS version. The example below installs MongoDB 8.0. Check the [official macOS installation guide](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-os-x/) for operating-system requirements.
3. Run these commands in Terminal.

```bash
brew tap mongodb/brew
brew update
brew install mongodb-community@8.0
```

Check the server and shell installations.

```bash
mongod --version
mongosh --version
```

If the shell is missing, install it separately.

```bash
brew install mongosh
```

### Start and stop

Start the Homebrew service and check its status.

```bash
brew services start mongodb-community@8.0
brew services list
```

Expect the MongoDB service to show `started`. The service runs in the background and is registered to start at login.

If MongoDB 7.0 is already installed, as on the original development Mac, use its service name instead. Run only the installed version on port 27017.

```bash
brew services start mongodb-community@7.0
```

To find the installed version, run `brew list --versions | rg mongodb`, or `brew list --versions` if ripgrep is unavailable.

Restart or stop the service using the same installed version.

```bash
brew services restart mongodb-community@8.0
brew services stop mongodb-community@8.0
```

### Troubleshoot startup

If `brew services list` shows an error, inspect the configuration and logs. Homebrew normally creates these during installation.

| Location | Apple Silicon default | Intel default |
| --- | --- | --- |
| Configuration | `/opt/homebrew/etc/mongod.conf` | `/usr/local/etc/mongod.conf` |
| Logs directory | `/opt/homebrew/var/log/mongodb` | `/usr/local/var/log/mongodb` |
| Data directory | `/opt/homebrew/var/mongodb` | `/usr/local/var/mongodb` |

`brew --prefix` identifies your actual Homebrew prefix. Check the paths configured in `mongod.conf` and the logs in the log directory. A missing configuration or data directory can prevent startup. Follow the installation guide to restore missing installation files and preserve any existing database files.

If macOS blocks `mongod`, follow the security approval steps in MongoDB's installation guide and retry startup.

## Windows

Use a supported 64-bit Windows version and the [official MongoDB Community Server MSI installation guide](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-windows/). Run these commands in Windows PowerShell.

### Install

1. Download MongoDB Community Server from https://www.mongodb.com/try/download/community. Select a version supported on your Windows release, choose **Windows** and **MSI**, then download it.
2. Run the installer and choose **Complete**.
3. Keep **Install MongoD as a Service** selected. Use the default service name **MongoDB** and the default service account and directories unless you have a reason to customize them.
4. Finish the installation. The installer normally starts the service.
5. Install MongoDB Shell separately from https://www.mongodb.com/try/download/shell. Add its executable directory to PATH if the installer does not do so, then open a new PowerShell window.
6. Verify the shell.

```powershell
mongosh --version
```

MongoDB Compass is optional. The application needs the MongoDB server running, and the shell is used for the connection check below.

### Start and stop

Open PowerShell **as Administrator** and check the service.

```powershell
Get-Service -Name MongoDB
```

If its status is `Stopped`, start it.

```powershell
Start-Service -Name MongoDB
Get-Service -Name MongoDB
```

Expect `Running`. Alternatively, press **Win+R**, enter `services.msc`, find **MongoDB**, and choose **Start**.

Restart or stop it when needed.

```powershell
Restart-Service -Name MongoDB
Stop-Service -Name MongoDB
```

If you chose a custom service name in the installer, substitute that name in the commands.

### Troubleshoot startup

- **Service not found** usually means MongoDB was installed without its Windows service. Rerun the MSI installer to install/configure the service, or follow MongoDB's service registration instructions.
- **Access denied** means the service command needs an Administrator PowerShell window.
- **`mongosh` not recognized** means the shell needs installation or its executable directory needs adding to PATH. Open a new terminal after updating PATH.
- If the service fails to start, inspect its command/configuration path in Windows Services properties and read the log path specified by that configuration. The MSI typically places `mongod.cfg` under `C:\Program Files\MongoDB\Server\<version>\bin\`.

## Connect Saunaman on either platform

In the repository root `.env`, set the local database address.

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/saunaman
```

Keep the other application settings in that file. This address creates a separate local development database. Production bookings and the production Google connection are stored separately.

Verify MongoDB responds. This command works in Terminal and PowerShell.

```text
mongosh "mongodb://127.0.0.1:27017/saunaman" --eval "db.runCommand({ ping: 1 })"
```

Expect `{ ok: 1 }`. MongoDB creates the `saunaman` database when the app first writes data.

From your clone's root directory, use Node.js 22.12+ and install dependencies on the first run.

```text
npm ci
npm ci --prefix client
npm run dev
```

Expect `Connected to MongoDB` in the backend terminal. Open http://localhost:3000. The app also needs its other environment settings, including Stripe and Resend, to start successfully. See [calendar and booking testing](../CALENDAR_TESTING.md) for those settings and the Google connection flow.

If you see `ECONNREFUSED`, confirm the service is running and listening on port 27017. Verify the `.env` uses `127.0.0.1` and restart the app after changing it. If the port is already occupied, check for another MongoDB instance before starting a second service. Keep the local server bound to loopback for local development.

## Official references

- [MongoDB macOS installation](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-os-x/)
- [MongoDB Windows installation](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-windows/)
- [MongoDB Windows service management](https://www.mongodb.com/docs/manual/administration/run-mongodb-windows/)
- [Homebrew service management](https://www.mongodb.com/docs/manual/administration/run-mongodb-brew/)
