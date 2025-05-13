const Property = require('../models/PropertyModel');
const Tenant = require('../models/TenantModel');
const Landlord = require('../models/LandlordModel');

const generateLeaseDraft = async ({ propertyId, tenantId, startDate, endDate, terms }) => {
    try {
        console.log('=== Starting Lease Draft Generation ===');
        console.log('Input parameters:', { propertyId, tenantId, startDate, endDate, terms });

        // Fetch property, tenant, and landlord details
        console.log('Fetching property details...');
        const property = await Property.findById(propertyId).populate('owner', 'username email phone');
        console.log('Property found:', property ? 'Yes' : 'No');
        console.log('Property owner:', property?.owner);

        console.log('Fetching tenant details...');
        const tenant = await Tenant.findById(tenantId);
        console.log('Tenant found:', tenant ? 'Yes' : 'No');

        if (!property || !tenant) {
            console.log('Missing required details:', {
                property: !!property,
                tenant: !!tenant
            });
            throw new Error('Required details not found');
        }

        console.log('Fetching landlord details...');
        const landlord = await Landlord.findById(property.owner._id);
        console.log('Landlord found:', landlord ? 'Yes' : 'No');

        if (!landlord) {
            console.log('Landlord not found for property owner:', property.owner._id);
            throw new Error('Landlord details not found');
        }

        // Calculate duration in months
        const start = new Date(startDate);
        const end = new Date(endDate);
        const duration = (end.getFullYear() - start.getFullYear()) * 12 + 
                        (end.getMonth() - start.getMonth());

        console.log('Calculated duration:', duration, 'months');

        // Generate lease draft
        const leaseDraft = {
            propertyDetails: {
                address: property.address,
                rentAmount: terms.rentAmount,
                securityDeposit: terms.securityDeposit,
                maintenanceFee: terms.maintenanceFee
            },
            leaseTerms: {
                startDate,
                endDate,
                duration: `${duration} months`,
                rentDueDate: 1, // 1st of every month
                securityDeposit: terms.securityDeposit,
                maintenanceFee: terms.maintenanceFee
            },
            additionalTerms: [
                "Tenant shall maintain the property in good condition",
                "Tenant shall not sublet the property without landlord's written consent",
                "Tenant shall pay utility bills on time",
                "Landlord shall provide 24 hours notice before property inspection",
                "Tenant shall not make structural changes without landlord's consent"
            ],
            parties: {
                tenant: {
                    name: tenant.username,
                    email: tenant.email,
                    phone: tenant.phone
                },
                landlord: {
                    name: landlord.username,
                    email: landlord.email,
                    phone: landlord.phone
                }
            }
        };

        console.log('Lease draft generated successfully');
        return leaseDraft;
    } catch (error) {
        console.error('Error in generateLeaseDraft:', error);
        throw error;
    }
};

module.exports = { generateLeaseDraft }; 