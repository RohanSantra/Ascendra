import "dotenv/config";

/**
 * Reads a required environment variable.
 *
 * @name getRequiredEnv
 * @param {string} name - Environment variable name.
 * @returns {string} Environment variable value.
 * @throws {Error} When the variable is missing or empty.
 */
const getRequiredEnv = (name) => {
    const value = process.env[name];

    if (!value || value.trim() === "") {
        throw new Error(
            `Missing required environment variable: ${name}`
        );
    }

    return value.trim();
};

/**
 * Reads an optional environment variable.
 *
 * @name getOptionalEnv
 * @param {string} name - Environment variable name.
 * @param {string} defaultValue - Default value.
 * @returns {string} Environment variable or default value.
 */
const getOptionalEnv = (name, defaultValue = "") => {
    const value = process.env[name];

    if (!value || value.trim() === "") {
        return defaultValue;
    }

    return value.trim();
};

/**
 * Reads an optional numeric environment variable.
 *
 * @name getNumberEnv
 * @param {string} name - Environment variable name.
 * @param {number} defaultValue - Default value.
 * @returns {number} Parsed finite numeric value.
 * @throws {Error} When the provided value is not finite.
 */
const getNumberEnv = (name, defaultValue) => {
    const value = process.env[name];

    if (value === undefined || value.trim() === "") {
        return defaultValue;
    }

    const parsedValue = Number(value);

    if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
        throw new Error(
            `Environment variable ${name} must be a positive integer`
        );
    }

    return parsedValue;
};

/**
 * Application environment configuration.
 *
 * @name env
 */
const env = Object.freeze({
    nodeEnv: getOptionalEnv("NODE_ENV", "development"),

    app: {
        name: getOptionalEnv("APP_NAME", "ASCENDRA"),
        apiVersion: getOptionalEnv("API_VERSION", "v1"),
        port: getNumberEnv("PORT", 5000)
    },

    client: {
        url: getRequiredEnv("CLIENT_URL")
    },

    database: {
        uri: getRequiredEnv("MONGODB_URI")
    },

    auth: {
        accessToken: {
            secret: getRequiredEnv("JWT_ACCESS_SECRET"),
            expiresIn: getOptionalEnv(
                "JWT_ACCESS_EXPIRES_IN",
                "15m"
            )
        },

        refreshToken: {
            secret: getRequiredEnv("JWT_REFRESH_SECRET"),
            expiresIn: getOptionalEnv(
                "JWT_REFRESH_EXPIRES_IN",
                "7d"
            ),
            cookieName: getOptionalEnv(
                "JWT_REFRESH_COOKIE_NAME",
                "refreshToken"
            ),
            cookieMaxAge: getNumberEnv(
                "JWT_REFRESH_COOKIE_MAX_AGE",
                7 * 24 * 60 * 60 * 1000
            )
        },

        bcryptSaltRounds: getNumberEnv(
            "BCRYPT_SALT_ROUNDS",
            12
        )
    },

    email: {
        host: getOptionalEnv("SMTP_HOST"),
        port: getNumberEnv("SMTP_PORT", 587),
        secure: getOptionalEnv("SMTP_SECURE", "false").toLowerCase() === "true",
        user: getOptionalEnv("SMTP_USER"),
        password: getOptionalEnv("SMTP_PASSWORD"),
        from: getOptionalEnv("EMAIL_FROM")
    },

    bootstrap: {
        organization: {
            name: getOptionalEnv(
                "INITIAL_ORG_NAME",
                "Ascendra"
            ),
            slug: getOptionalEnv(
                "INITIAL_ORG_SLUG",
                "ascendra"
            )
        },

        admin: {
            firstName: getOptionalEnv("INITIAL_ADMIN_FIRST_NAME"),
            lastName: getOptionalEnv("INITIAL_ADMIN_LAST_NAME"),
            email: getOptionalEnv("INITIAL_ADMIN_EMAIL"),
            password: getOptionalEnv("INITIAL_ADMIN_PASSWORD")
        }
    },

    cloudinary: {
        cloudName: getOptionalEnv("CLOUDINARY_CLOUD_NAME"),
        apiKey: getOptionalEnv("CLOUDINARY_API_KEY"),
        apiSecret: getOptionalEnv("CLOUDINARY_API_SECRET")
    }
});

export default env;