const Lease = require("../models/LeaseModel")

class LeaseController {
    // Create a new lease
    async createLease(req, res) {
        try {
            const lease = new Lease(req.body);
            const savedLease = await lease.save();
            res.status(201).json(savedLease);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    // Get all leases
    async getAllLeases(req, res) {
        try {
            const leases = await Lease.find();
            res.status(200).json(leases);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // Get lease by ID
    async getLeaseById(req, res) {
        try {
            const lease = await Lease.findById(req.params.id);
            if (!lease) {
                return res.status(404).json({ message: 'Lease not found' });
            }
            res.status(200).json(lease);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    // Update lease
    async updateLease(req, res) {
        try {
            const updatedLease = await Lease.findByIdAndUpdate(
                req.params.id,
                req.body,
                { new: true }
            );
            if (!updatedLease) {
                return res.status(404).json({ message: 'Lease not found' });
            }
            res.status(200).json(updatedLease);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    // Delete lease
    async deleteLease(req, res) {
        try {
            const lease = await Lease.findByIdAndDelete(req.params.id);
            if (!lease) {
                return res.status(404).json({ message: 'Lease not found' });
            }
            res.status(200).json({ message: 'Lease deleted successfully' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = new LeaseController();