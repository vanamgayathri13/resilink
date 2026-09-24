import cds from '@sap/cds';
import * as recovery from './recovery.js';

export default cds.service.impl(async function () {

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

        // Calculate shortage
        const shortage = recovery.calculateShortage(
            affectedPlant.plannedCapacity,
            affectedPlant.availableCapacity
        );

        // Get all plants
        const plants = await SELECT.from('resilink.Plants');

        // Find alternative plants
        const alternatives = recovery.findAlternativePlants(
            plants,
            affectedPlant.ID
        );

        return JSON.stringify({
            disruption: disruption.title,
            affectedPlant: affectedPlant.name,
            shortage: shortage,
            alternatives: alternatives
        });
    });

});