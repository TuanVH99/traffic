const swaggerJSDoc = require("swagger-jsdoc");
const { env } = require("./env");

const options = {
    definition: {
        openapi: "3.0.3",
        info: {
            title: "Auth API",
            version: "1.0.0",
            description: "Express + MongoDB authentication API",
        },
        servers: [
            { url: `http://localhost:${env.port}`, description: "Local" },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
                refreshCookie: {
                    type: "apiKey",
                    in: "cookie",
                    name: "refreshToken",
                },
            },
            schemas: {
                ErrorResponse: {
                    type: "object",
                    properties: {
                        error: {
                            type: "object",
                            properties: {
                                code: { type: "string" },
                                message: { type: "string" },
                            },
                            required: ["code", "message"],
                        },
                    },
                    required: ["error"],
                },
            },
        },
    },
    // Quét JSDoc trong routes/controllers
    apis: ["./src/modules/**/*.routes.js", "./src/modules/**/*.controller.js"],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = { swaggerSpec };
