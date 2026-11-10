
import mongoose from "mongoose";

import {
    env,
    connectDatabase,
    disconnectDatabase
} from "../src/config/index.js";

import User from "../src/modules/auth/user.model.js";
import Organization from "../src/modules/organizations/organization.model.js";
import OrganizationMembership from "../src/modules/organizationMemberships/organizationMembership.model.js";

import { hashPassword } from "../src/modules/auth/auth.utils.js";


/**
 * @name getBootstrapConfig
 * @description Reads and validates the initial organization and
 * Platform Administrator configuration.
 * @returns {Object} Validated bootstrap configuration.
 * @throws {Error} When required configuration is invalid.
 */
const getBootstrapConfig = () => {
    const config = {
        organizationName: env.bootstrap.organization.name.trim(),

        organizationSlug: env.bootstrap.organization.slug
            .trim()
            .toLowerCase(),

        adminFirstName: env.bootstrap.admin.firstName.trim(),

        adminLastName: env.bootstrap.admin.lastName.trim(),

        adminEmail: env.bootstrap.admin.email
            .trim()
            .toLowerCase(),

        adminPassword: env.bootstrap.admin.password
    };

    const missingValues = Object.entries(config)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missingValues.length > 0) {
        throw new Error(
            `Missing bootstrap configuration: ${missingValues.join(", ")}`
        );
    }

    // Validate the organization slug.
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(config.organizationSlug)) {
        throw new Error("Invalid initial organization slug.");
    }

    // Validate the administrator email.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.adminEmail)) {
        throw new Error("Invalid initial administrator email address.");
    }

    // Enforce a minimum administrator password length.
    if (config.adminPassword.length < 12) {
        throw new Error(
            "Initial administrator password must be at least 12 characters."
        );
    }

    return config;
};


/**
 * @name bootstrapAscendra
 * @description Creates the initial Platform Administrator,
 * initial active Ascendra organization and approved
 * Organization Administrator membership.
 *
 * The operation is transactional and safe to execute again
 * after a successful bootstrap.
 *
 * @returns {Promise<void>}
 */
const bootstrapAscendra = async () => {
    const config = getBootstrapConfig();

    let mongoSession;

    try {
        await connectDatabase();

        mongoSession = await mongoose.startSession();

        let alreadyConfigured = false;

        let createdAdmin;
        let createdOrganization;
        let createdMembership;

        await mongoSession.withTransaction(async () => {
            alreadyConfigured = false;

            createdAdmin = undefined;
            createdOrganization = undefined;
            createdMembership = undefined;

            // Find the configured initial organization.
            const existingOrganization = await Organization.findOne({
                slug: config.organizationSlug
            }).session(mongoSession);

            // Find the configured initial administrator.
            const existingAdmin = await User.findOne({
                email: config.adminEmail
            }).session(mongoSession);

            /*
             * If both records exist, verify that the initial
             * bootstrap setup is already complete.
             */
            if (existingOrganization && existingAdmin) {

                const existingMembership =
                    await OrganizationMembership.findOne({
                        org: existingOrganization._id,
                        user: existingAdmin._id
                    }).session(mongoSession);

                const isComplete =
                    existingAdmin.platformRole === "platform_admin" &&
                    existingAdmin.status === "active" &&
                    existingOrganization.status === "active" &&
                    existingMembership?.role === "admin" &&
                    existingMembership?.status === "approved";

                if (isComplete) {
                    alreadyConfigured = true;
                    return;
                }
            }

            /*
             * Prevent bootstrap from creating another initial
             * administrator when an incomplete or conflicting
             * setup already exists.
             */
            if (existingOrganization || existingAdmin) {
                throw new Error(
                    "A partial bootstrap setup or conflicting record exists. " +
                    "Inspect the existing records before continuing."
                );
            }

            // Ensure that another Platform Administrator does not
            // already exist under a different configured email.
            const existingPlatformAdmin = await User.findOne({
                platformRole: "platform_admin"
            })
                .select("_id")
                .session(mongoSession)
                .lean();

            if (existingPlatformAdmin) {
                throw new Error(
                    "A Platform Administrator already exists. " +
                    "Bootstrap cannot create another initial administrator."
                );
            }

            // Hash the initial administrator password.
            const passwordHash = await hashPassword(
                config.adminPassword
            );

            // Create the initial Platform Administrator.
            const [admin] = await User.create(
                [
                    {
                        firstName: config.adminFirstName,
                        lastName: config.adminLastName,
                        email: config.adminEmail,
                        passwordHash,
                        platformRole: "platform_admin",
                        status: "active"
                    }
                ],
                {
                    session: mongoSession
                }
            );

            // Create the initial active Ascendra organization.
            const now = new Date();

            const [organization] = await Organization.create(
                [
                    {
                        name: config.organizationName,
                        slug: config.organizationSlug,
                        status: "active",

                        statusChangedAt: now,
                        statusChangedBy: admin._id,
                        statusChangeReason: "Initial platform setup",

                        createdBy: admin._id
                    }
                ],
                {
                    session: mongoSession
                }
            );

            // Create the initial administrator's approved membership.
            const [membership] = await OrganizationMembership.create(
                [
                    {
                        org: organization._id,
                        user: admin._id,

                        role: "admin",
                        status: "approved",

                        joinedAt: now,
                        approvedBy: admin._id,
                        approvedAt: now
                    }
                ],
                {
                    session: mongoSession
                }
            );

            createdAdmin = admin;
            createdOrganization = organization;
            createdMembership = membership;
        });

        // Handle repeat execution without modifying existing records.
        if (alreadyConfigured) {
            console.log("\nAscendra bootstrap has already been completed.");
            console.log("No changes were made.");

            return;
        }

        // Display the successfully created initial records.
        console.log("\nAscendra bootstrap completed successfully.");
        console.log("----------------------------------------");

        console.log(`Organization: ${createdOrganization.name}`);
        console.log(`Organization ID: ${createdOrganization._id}`);

        console.log(
            `Platform Administrator: ${createdAdmin.firstName} ${createdAdmin.lastName}`
        );

        console.log(`Admin Email: ${createdAdmin.email}`);
        console.log(`Platform Role: ${createdAdmin.platformRole}`);

        console.log(`Membership ID: ${createdMembership._id}`);
        console.log(`Organization Role: ${createdMembership.role}`);
        console.log(`Membership Status: ${createdMembership.status}`);

        console.log("----------------------------------------\n");

    } finally {

        if (mongoSession) {
            await mongoSession.endSession();
        }

        await disconnectDatabase();
    }
};


// Execute the bootstrap operation.
bootstrapAscendra().catch((error) => {
    console.error("\nAscendra bootstrap failed.");
    console.error(error.message);

    process.exitCode = 1;
});
