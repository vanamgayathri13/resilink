// Calculate production shortage
export function calculateShortage(plannedCapacity, availableCapacity) {
    return Math.max(0, plannedCapacity - availableCapacity);
}


// Find alternative plants and calculate recovery allocation
export function findAlternativePlants(plants, affectedPlantId, shortage) {

    // Find plants that can support recovery
    const alternatives = plants
        .filter(plant => plant.ID !== affectedPlantId)
        .filter(plant => plant.availableCapacity > 0)
        .sort((a, b) => b.availableCapacity - a.availableCapacity);

    let remainingShortage = shortage;

    // Allocate production to alternative plants
    return alternatives.map(plant => {

        const allocation = Math.min(
            plant.availableCapacity,
            remainingShortage
        );

        remainingShortage -= allocation;

        return {
            plant: plant.name,
            location: plant.location,
            availableCapacity: plant.availableCapacity,
            recommendedAllocation: allocation,
            canCoverShortage: plant.availableCapacity >= shortage,
            remainingShortage: remainingShortage
        };
    });
}