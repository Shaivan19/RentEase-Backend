const Property = require('../models/PropertyModel');
const Tenant = require('../models/TenantModel');
const Landlord = require('../models/LandlordModel');
const Booking = require('../models/BookProperty');
const VisitProperty= require('../models/VisitpropertyModel')

const DashboardController = {
    getTenantDashboard: async (req, res) => {
        try{
            const tenantId = req.user.id;

            const[
                rentedProperties,
                upcomingVisits,
                recentBookings ,
                savedProperties,
            ]= await Promise.all([
                Property.find({ 'currentTenant':tenantId }).populate('owner','username email phone'),

                //---get upcomibg propertyt vuist----//
                VisitProperty.find({ 
                    tenantId: tenantId,
                    visitDate:{$gte:new Date()}
                 }).sort({visitDate:1}).limit(5).populate('property','title address images'),

                //---get recent bookings----//
                Booking.find({ tenantId: tenantId }).sort({createdAt:-1}).limit(5).populate('property','title address images').populate('landlord','username email'),

                //---get saved properties----//
                Property.find({'savedBy': tenantId,
                    'currentTenant': {$ne: tenantId}
                }).populate('owner','username email').limit(5),
            ]);

            res.json({
                success:true,
                data: {
                    currentProperties: rentedProperties.map(property=>({
                        id:property._id,
                        name:property.title,
                        address:property.address,
                        rent:property.price,
                        landlordName:property.owner.username,
                        // landlordcosroperty.landlord._id,
                        landlordContact:property.owner.phone,
                        images:property.images[0]|| null,
                    })),
                    upcomingVisits: upcomingVisits.map(visit=>({
                        id:visit._id,
                        // propertyId:visit.property._id,
                        propertyName:visit.property.title,
                        address:visit.property.address,
                        visitDate:visit.visitDate,
                        // landlordName:visit.property.landlord.username,
                        status: visit.status,
                        image:visit.property.images[0] || null,
                        // landlordContact:visit.property.landlord.phone,
                    })),
                    recentBookings: recentBookings.map(booking=>({
                        id:booking._id,
                        // propertyId:booking.property._id,
                        propertyName:booking.property.title,
                        address:booking.property.address,
                        landlordName:booking.landlord.username,
                        status: booking.status,
                        bookingDate:booking.createdAt,
                        image:booking.property.images[0] || null,
                    })),
                    savedProperties: savedProperties.map(property=>({
                        id:property._id,
                        name:property.title,
                        address:property.address,
                        rent:property.price,
                        landlordName:property.owner.username,
                        // landlordContact:property.landlord.phone,
                        images:property.images[0]|| null,
                    })),
                    stats:{
                        totalRented: rentedProperties.length,
                        totalVisits: upcomingVisits.length,
                        totalBookings: recentBookings.length,
                        savedCount: savedProperties.length,
                    }
                }
            });
        } catch(error){
            res.status(500).json({
                success:false,
                message:'Internal server error',
                error:error.message,
            });
        }
    },

    //---get landlord dashboard----//
    getLandlordDashboard: async (req, res) => {
        try {
            const landlordId = req.user.id;
            console.log('Landlord ID:', landlordId); // Debug log
    
            // First, get the properties separately to check if this works
            const properties = await Property.find({ owner: landlordId });
            console.log('Found properties:', properties.length); // Debug log
    
            const [
                propertiesWithTenant,
                upcomingVisits,
                propertyBookings,
                // recentPropertyViews commented out since it's not used
            ] = await Promise.all([
                // Modified query to check if populate is the issue
                Property.find({ owner: landlordId })
                    .select('title address price images currentTenant')
                    .lean(), // Using lean() for better performance
    
                // Get upcoming property visits
                VisitProperty.find({ 
                    property: { 
                        $in: properties.map(p => p._id) 
                    },
                    visitDate: { $gte: new Date() }
                })
                .sort({ visitDate: 1 })
                .limit(5)
                .populate('tenant', 'username email')
                .populate('property', 'title address'),
    
                // Get recent booking requests
                Booking.find({
                    property: {
                        $in: properties.map(p => p._id)
                    }
                })
                .sort({ createdAt: -1 })
                .limit(5)
                .populate('tenant', 'username email')
                .populate('property', 'title address'),
            ]);
    
            // Calculate occupancy rate
            const occupiedProperties = propertiesWithTenant.filter(p => p.currentTenant).length;
            const occupancyRate = properties.length > 0 
                ? (occupiedProperties / properties.length) * 100 
                : 0;
    
            const response = {
                success: true,
                data: {
                    properties: propertiesWithTenant.map(property => ({
                        id: property._id,
                        name: property.title,
                        address: property.address,
                        rent: property.price,
                        status: property.currentTenant ? 'Occupied' : 'Available',
                        images: property.images?.[0] || null
                    })),
                    upcomingVisits: upcomingVisits.map(visit => ({
                        id: visit._id,
                        propertyName: visit.property?.title,
                        tenantName: visit.tenant?.username,
                        tenantEmail: visit.tenant?.email,
                        visitDate: visit.visitDate,
                        status: visit.status
                    })),
                    recentBookings: propertyBookings.map(booking => ({
                        id: booking._id,
                        propertyName: booking.property?.title,
                        tenantName: booking.tenant?.username,
                        tenantEmail: booking.tenant?.email,
                        status: booking.status,
                        bookingDate: booking.createdAt
                    })),
                    stats: {
                        totalProperties: properties.length,
                        occupiedProperties,
                        occupancyRate: Math.round(occupancyRate),
                        totalBookings: propertyBookings.length,
                        upcomingVisitsCount: upcomingVisits.length
                    }
                }
            };
    
            console.log('Sending response:', JSON.stringify(response, null, 2)); // Debug log
            res.json(response);
    
        } catch (error) {
            console.error('Dashboard Error Details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            
            res.status(500).json({
                success: false,
                message: 'Error fetching dashboard data',
                error: error.message,
                errorType: error.name
            });
        }
    },
}

module.exports = DashboardController;