#!/bin/sh
set -e

# cognito-local derives the JWT `iss` claim from TokenConfig.IssuerDomain
# (default http://localhost:9229) in .cognito/config.json, independent of the
# listen port. To let the port be configured via LOCAL_COGNITO_PORT, we listen
# on $PORT and write a matching IssuerDomain so the emitted `iss` and the
# serverless authorizer's issuerUrl stay consistent (both http://localhost:$PORT).
#
# The config is merged (not overwritten) so any other cognito-local defaults or
# user-provided settings in .cognito/config.json are preserved.

PORT="${PORT:-9229}"
CONFIG_DIR="/app/.cognito"
CONFIG_FILE="${CONFIG_DIR}/config.json"

mkdir -p "${CONFIG_DIR}"

PORT="${PORT}" CONFIG_FILE="${CONFIG_FILE}" node -e '
  const fs = require("fs");
  const file = process.env.CONFIG_FILE;
  const port = process.env.PORT;
  let config = {};
  try {
    config = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") {
      // The file exists but could not be read/parsed (corrupted, permissions,
      // manual edit mistake). Do NOT silently reset it — that would drop any
      // other cognito-local settings the developer added. Fail fast instead.
      console.error(
        `[cognito-local] Failed to read ${file}: ${e.message}. ` +
          "Refusing to overwrite it — fix or delete the file and retry.",
      );
      process.exit(1);
    }
    // ENOENT: first run, no config yet — start from an empty object.
  }
  config.TokenConfig = Object.assign({}, config.TokenConfig, {
    IssuerDomain: `http://localhost:${port}`,
  });
  fs.writeFileSync(file, JSON.stringify(config, null, 2));
  console.log(`[cognito-local] IssuerDomain set to http://localhost:${port}`);
'

exec env HOST=0.0.0.0 PORT="${PORT}" npx cognito-local
