export function calculateShortage(plannedCapacity, availableCapacity) {
    return Math.max(0, plannedCapacity - availableCapacity);
}

export function findAlternativePlants(plants, affectedPlantId) {
    return plants
        .filter(plant => plant.ID !== affectedPlantId)
        .filter(plant => plant.availableCapacity > 0)
        .map(plant => ({
            plant: plant.name,
            location: plant.location,
            availableCapacity: plant.availableCapacity
        }));
}