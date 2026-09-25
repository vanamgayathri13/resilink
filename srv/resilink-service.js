import cds from '@sap/cds';
import * as recovery from './recovery.js';

export default cds.service.impl(async function () {

    // ==========================================
    // 1. ANALYZE DISRUPTION
    // ==========================================

    this.on('analyzeDisruption', async (req) => {

        const { disruptionID } = req.data;

        // Find the selected disruption
        const disruption = await SELECT.one
            .from('resilink.Disruptions')
            .where({ ID: disruptionID });

        if (!disruption) {
            return JSON.stringify({
                error: 'Disruption not found'
            });
        }

        // Find the affected plant
        const affectedPlant = await SELECT.one
            .from('resilink.Plants')
            .where({ ID: disruption.plant_ID });

        if (!affectedPlant) {
            return JSON.stringify({
                error: 'Affected plant not found'
            });
        }

        // Calculate production shortage
        const shortage = recovery.calculateShortage(
            affectedPlant.plannedCapacity,
            affectedPlant.availableCapacity
        );

        // Get all plants
        const plants = await SELECT.from('resilink.Plants');

        // Find alternative plants and allocate production
        const alternatives = recovery.findAlternativePlants(
            plants,
            affectedPlant.ID,
            shortage
        );

        // Calculate total allocated production
        const totalAllocated = alternatives.reduce(
            (total, plant) =>
                total + plant.recommendedAllocation,
            0
        );

        // Calculate remaining shortage
        const remainingShortage = Math.max(
            0,
            shortage - totalAllocated
        );

        // ==========================================
        // DETERMINE RECOVERY STATUS
        // ==========================================

        // Preserve the saved status if already approved or rejected
        let recoveryStatus;

        if (
            disruption.status === 'Recovery Approved' ||
            disruption.status === 'Recovery Rejected'
        ) {
            recoveryStatus = disruption.status;
        } else if (remainingShortage === 0) {
            recoveryStatus = 'Awaiting Approval';
        } else {
            recoveryStatus =
                'Partial Recovery - Additional Capacity Required';
        }

        // ==========================================
        // RETURN RECOVERY ANALYSIS
        // ==========================================

        return JSON.stringify({

            disruption: disruption.title,

            affectedPlant: affectedPlant.name,

            shortage: shortage,

            alternatives: alternatives,

            totalAllocated: totalAllocated,

            remainingShortage: remainingShortage,

            recoveryStatus: recoveryStatus

        });

    });


    // ==========================================
    // 2. APPROVE RECOVERY
    // ==========================================

    this.on('approveRecovery', async (req) => {

        const { disruptionID } = req.data;

        // Check if disruption exists
        const disruption = await SELECT.one
            .from('resilink.Disruptions')
            .where({ ID: disruptionID });

        if (!disruption) {
            return JSON.stringify({
                error: 'Disruption not found'
            });
        }

        // Update disruption status in database
        await UPDATE('resilink.Disruptions')
            .set({
                status: 'Recovery Approved'
            })
            .where({
                ID: disruptionID
            });

        // Return approval response
        return JSON.stringify({

            message: 'Recovery approved successfully',

            disruptionID: disruptionID,

            status: 'Recovery Approved'

        });

    });


    // ==========================================
    // 3. REJECT RECOVERY
    // ==========================================

    this.on('rejectRecovery', async (req) => {

        const { disruptionID } = req.data;

        // Check if disruption exists
        const disruption = await SELECT.one
            .from('resilink.Disruptions')
            .where({ ID: disruptionID });

        if (!disruption) {
            return JSON.stringify({
                error: 'Disruption not found'
            });
        }

        // Update disruption status in database
        await UPDATE('resilink.Disruptions')
            .set({
                status: 'Recovery Rejected'
            })
            .where({
                ID: disruptionID
            });

        // Return rejection response
        return JSON.stringify({

            message: 'Recovery recommendation rejected',

            disruptionID: disruptionID,

            status: 'Recovery Rejected'

        });

    });

});