import cds from '@sap/cds';


// ==========================================================
// BUILD RECOVERY ANALYSIS
// ==========================================================

async function buildAnalysis(disruptionID, rejectedKeys = []) {

    const disruption = await SELECT.one
        .from('resilink.Disruptions')
        .where({ ID: disruptionID });

    if (!disruption) {
        return {
            error: 'Disruption not found'
        };
    }


    const affectedPlant = await SELECT.one
        .from('resilink.Plants')
        .where({ ID: disruption.plant_ID });

    if (!affectedPlant) {
        return {
            error: 'Affected plant not found'
        };
    }


    const plants =
        await SELECT.from('resilink.Plants');

    const suppliers =
        await SELECT.from('resilink.Suppliers');

    const inventory =
        await SELECT.from('resilink.Inventory');


    // ------------------------------------------------------
    // Determine affected material
    // ------------------------------------------------------

    const affectedInventory = inventory.find(
        item =>
            item.plant_ID === affectedPlant.ID
    );

    const material =
        affectedInventory?.material || null;


    // ------------------------------------------------------
    // Calculate shortage
    // ------------------------------------------------------

    const shortage = Math.max(
        0,
        Number(
            disruption.affectedQuantity ??
            (
                Number(affectedPlant.plannedCapacity) -
                Number(affectedPlant.availableCapacity)
            )
        )
    );


    // ======================================================
    // PRODUCTION SHIFT
    // ======================================================

    let remainingProduction = shortage;

    const productionOptions =
        plants

            .filter(
                plant =>
                    plant.ID !== affectedPlant.ID
            )

            .filter(
                plant =>
                    Number(plant.availableCapacity) > 0
            )

            .sort(
                (a, b) =>
                    Number(b.availableCapacity) -
                    Number(a.availableCapacity)
            )

            .map(plant => {

                const allocation =
                    Math.min(
                        Number(plant.availableCapacity),
                        remainingProduction
                    );

                remainingProduction -= allocation;

                return {
                    plantID: plant.ID,
                    plant: plant.name,
                    location: plant.location,
                    availableCapacity:
                        Number(plant.availableCapacity),
                    recommendedAllocation:
                        allocation
                };
            });


    const productionCoverage =
        productionOptions.reduce(
            (sum, item) =>
                sum + item.recommendedAllocation,
            0
        );


    // ======================================================
    // INVENTORY REALLOCATION
    // ======================================================

    let remainingInventory =
        shortage;

    const inventoryOptions =
        inventory

            .filter(
                item =>
                    item.plant_ID !== affectedPlant.ID
            )

            .filter(
                item =>
                    !material ||
                    item.material === material
            )

            .filter(
                item =>
                    Number(item.quantity) > 0
            )

            .sort(
                (a, b) =>
                    Number(b.quantity) -
                    Number(a.quantity)
            )

            .map(item => {

                const allocation =
                    Math.min(
                        Number(item.quantity),
                        remainingInventory
                    );

                remainingInventory -= allocation;

                return {
                    inventoryID: item.ID,
                    sourcePlantID: item.plant_ID,
                    material: item.material,
                    availableQuantity:
                        Number(item.quantity),
                    recommendedAllocation:
                        allocation
                };
            });


    const inventoryCoverage =
        inventoryOptions.reduce(
            (sum, item) =>
                sum + item.recommendedAllocation,
            0
        );


    // ======================================================
    // SUPPLIER OPTIONS
    // ======================================================

    const supplierOptions =
        suppliers

            .filter(
                supplier =>
                    !material ||
                    supplier.material === material
            )

            .filter(
                supplier =>
                    Number(supplier.capacity) > 0
            )

            .sort(
                (a, b) =>
                    Number(a.leadTimeDays) -
                    Number(b.leadTimeDays)
            )

            .map(supplier => {

                const quantity =
                    Math.min(
                        Number(supplier.capacity),
                        shortage
                    );

                return {
                    supplierID: supplier.ID,
                    supplier: supplier.name,
                    material: supplier.material,
                    capacity:
                        Number(supplier.capacity),
                    leadTimeDays:
                        Number(supplier.leadTimeDays),
                    recommendedQuantity:
                        quantity
                };
            });


    // ======================================================
    // SCENARIOS
    // ======================================================

    const scenarios = [

        {
            key: 'Wait',
            type: 'Wait',
            coverage: 0,
            remainingShortage: shortage,
            recoveryTimeDays: null,
            risk: 'High',
            serviceLevel: 'Low',
            dependsOn: []
        },


        {
            key: 'Inventory Reallocation',
            type: 'Inventory Reallocation',
            coverage: inventoryCoverage,
            remainingShortage:
                Math.max(
                    0,
                    shortage - inventoryCoverage
                ),
            recoveryTimeDays: 1,
            risk: 'Low',
            serviceLevel:
                inventoryCoverage >= shortage
                    ? 'High'
                    : 'Medium',
            allocations:
                inventoryOptions,
            dependsOn: []
        },


        {
            key: 'Production Shift',
            type: 'Production Shift',
            coverage: productionCoverage,
            remainingShortage:
                Math.max(
                    0,
                    shortage - productionCoverage
                ),
            recoveryTimeDays: 2,
            risk: 'Low',
            serviceLevel:
                productionCoverage >= shortage
                    ? 'High'
                    : 'Medium',
            allocations:
                productionOptions,
            dependsOn: []
        },


        ...supplierOptions.map(
            supplier => ({

                key:
                    'Supplier:' +
                    supplier.supplier,

                type:
                    'Alternate Supplier',

                supplier:
                    supplier.supplier,

                supplierID:
                    supplier.supplierID,

                coverage:
                    supplier.recommendedQuantity,

                remainingShortage:
                    Math.max(
                        0,
                        shortage -
                        supplier.recommendedQuantity
                    ),

                recoveryTimeDays:
                    supplier.leadTimeDays,

                risk:
                    'Medium',

                serviceLevel:
                    supplier.recommendedQuantity >= shortage
                        ? 'High'
                        : 'Medium',

                dependsOn: []
            })
        ),


        {
            key: 'Combined Recovery',
            type: 'Combined Recovery',

            coverage:
                Math.min(
                    shortage,
                    inventoryCoverage +
                    productionCoverage
                ),

            remainingShortage:
                Math.max(
                    0,
                    shortage -
                    inventoryCoverage -
                    productionCoverage
                ),

            recoveryTimeDays: 2,

            risk: 'Low',

            serviceLevel:
                inventoryCoverage +
                productionCoverage >= shortage
                    ? 'Very High'
                    : 'High',

            inventoryCoverage,
            productionCoverage,

            // Combined scenario depends on both.
            dependsOn: [
                'Inventory Reallocation',
                'Production Shift'
            ]
        }
    ];


    // ======================================================
    // REMOVE REJECTED / DEPENDENT SCENARIOS
    // ======================================================

    const availableScenarios =
        scenarios.filter(scenario => {

            if (
                rejectedKeys.includes(
                    scenario.key
                )
            ) {
                return false;
            }


            const dependencyRejected =
                (scenario.dependsOn || [])
                    .some(
                        dependency =>
                            rejectedKeys.includes(
                                dependency
                            )
                    );


            if (dependencyRejected) {
                return false;
            }


            return true;
        });


    // ======================================================
    // RECOMMENDATION
    // ======================================================

    const complete =
        availableScenarios.filter(
            scenario =>
                scenario.remainingShortage === 0
        );


    const candidates =
        complete.length
            ? complete
            : availableScenarios;


    const riskRank = {
        Low: 1,
        Medium: 2,
        High: 3
    };


    const recommendation =
        candidates.length

            ? candidates
                .slice()
                .sort((a, b) => {

                    const timeA =
                        a.recoveryTimeDays ?? 999;

                    const timeB =
                        b.recoveryTimeDays ?? 999;


                    if (timeA !== timeB) {
                        return timeA - timeB;
                    }


                    return (
                        (riskRank[a.risk] || 99) -
                        (riskRank[b.risk] || 99)
                    );
                })[0]

            : null;


    // ======================================================
    // RESULT
    // ======================================================

    return {

        disruption: {

            id:
                disruption.ID,

            title:
                disruption.title,

            description:
                disruption.description,

            affectedQuantity:
                disruption.affectedQuantity
        },


        affectedPlant: {

            id:
                affectedPlant.ID,

            name:
                affectedPlant.name,

            location:
                affectedPlant.location,

            plannedCapacity:
                affectedPlant.plannedCapacity,

            availableCapacity:
                affectedPlant.availableCapacity
        },


        material,

        shortage,


        network: {

            plants:
                plants.length,

            suppliers:
                suppliers.length,

            inventoryRecords:
                inventory.length
        },


        scenarios:
            availableScenarios,

        recommendation,

        rejectedScenarioKeys:
            rejectedKeys,


        recoveryStatus:
            recommendation &&
            recommendation.remainingShortage === 0

                ? 'Awaiting Approval'

                : recommendation

                    ? 'Partial Recovery - Additional Capacity Required'

                    : 'No Recovery Options Remaining'
    };
}


// ==========================================================
// CAP SERVICE
// ==========================================================

export default cds.service.impl(async function () {


    // ======================================================
    // ANALYZE
    // ======================================================

    this.on(
        'analyzeDisruption',
        async req => {

            const {
                disruptionID
            } = req.data;


            const analysis =
                await buildAnalysis(
                    disruptionID,
                    []
                );


            return JSON.stringify(
                analysis
            );
        }
    );


    // ======================================================
    // APPLY APPROVED RECOVERY SCENARIO
    // ======================================================

    async function applyRecoveryScenario(
        scenario,
        analysis
    ) {

        if (!scenario) {
            throw new Error("Recovery scenario not found.");
        }

        // ----------------------------------------------
        // INVENTORY REALLOCATION
        // ----------------------------------------------

        if (
            scenario.type === 'Inventory Reallocation' &&
            scenario.allocations
        ) {

            for (const allocation of scenario.allocations) {

                const quantity =
                    Number(
                        allocation.recommendedAllocation || 0
                    );

                if (quantity <= 0) {
                    continue;
                }

                const sourceInventory =
                    await SELECT.one
                        .from('resilink.Inventory')
                        .where({
                            ID:
                                allocation.inventoryID
                        });

                if (!sourceInventory) {
                    throw new Error(
                        'Source inventory record not found: ' +
                        allocation.inventoryID
                    );
                }

                if (
                    Number(sourceInventory.quantity || 0) <
                    quantity
                ) {
                    throw new Error(
                        'Insufficient inventory in source record.'
                    );
                }

                const targetInventory =
                    await SELECT.one
                        .from('resilink.Inventory')
                        .where({
                            material:
                                analysis.material,
                            plant_ID:
                                analysis.affectedPlant.id
                        });

                if (!targetInventory) {
                    throw new Error(
                        'Target inventory record not found for affected plant.'
                    );
                }

                await UPDATE(
                    'resilink.Inventory'
                )
                    .set({
                        quantity:
                            Number(sourceInventory.quantity) -
                            quantity
                    })
                    .where({
                        ID:
                            sourceInventory.ID
                    });

                await UPDATE(
                    'resilink.Inventory'
                )
                    .set({
                        quantity:
                            Number(targetInventory.quantity || 0) +
                            quantity
                    })
                    .where({
                        ID:
                            targetInventory.ID
                    });
            }

            return {
                applied: true,
                message:
                    'Inventory reallocation applied successfully.'
            };
        }


        // ----------------------------------------------
        // PRODUCTION SHIFT
        // ----------------------------------------------

        if (
            scenario.type === 'Production Shift' &&
            scenario.allocations
        ) {

            for (const allocation of scenario.allocations) {

                const quantity =
                    Number(
                        allocation.recommendedAllocation || 0
                    );

                if (quantity <= 0) {
                    continue;
                }

                const plant =
                    await SELECT.one
                        .from('resilink.Plants')
                        .where({
                            ID:
                                allocation.plantID
                        });

                if (!plant) {
                    throw new Error(
                        'Production plant not found: ' +
                        allocation.plantID
                    );
                }

                if (
                    Number(plant.availableCapacity || 0) <
                    quantity
                ) {
                    throw new Error(
                        'Insufficient available production capacity at ' +
                        plant.name
                    );
                }

                await UPDATE(
                    'resilink.Plants'
                )
                    .set({
                        availableCapacity:
                            Number(plant.availableCapacity) -
                            quantity
                    })
                    .where({
                        ID:
                            plant.ID
                    });
            }

            return {
                applied: true,
                message:
                    'Production shift applied successfully.'
            };
        }


        // ----------------------------------------------
        // ALTERNATE SUPPLIER
        // ----------------------------------------------

        if (
            scenario.type === 'Alternate Supplier'
        ) {

            const supplier =
                await SELECT.one
                    .from('resilink.Suppliers')
                    .where({
                        ID:
                            scenario.supplierID
                    });

            if (!supplier) {
                throw new Error(
                    'Supplier not found: ' +
                    scenario.supplier
                );
            }

            const quantity =
                Number(
                    scenario.coverage || 0
                );

            if (
                Number(supplier.capacity || 0) <
                quantity
            ) {
                throw new Error(
                    'Supplier capacity is insufficient.'
                );
            }

            await UPDATE(
                'resilink.Suppliers'
            )
                .set({
                    capacity:
                        Number(supplier.capacity) -
                        quantity
                })
                .where({
                    ID:
                        supplier.ID
                });

            return {
                applied: true,
                message:
                    'Alternate supplier capacity committed successfully.'
            };
        }


        // ----------------------------------------------
        // WAIT
        // ----------------------------------------------

        if (
            scenario.type === 'Wait'
        ) {

            return {
                applied: true,
                message:
                    'Recovery plan approved with no immediate network changes.'
            };
        }


        // ----------------------------------------------
        // FALLBACK
        // ----------------------------------------------

        return {
            applied: false,
            message:
                'Recovery approved, but this scenario has no executable network update yet.'
        };
    }


    // ======================================================
    // APPROVE
    // ======================================================

    this.on(
        'approveRecovery',
        async req => {

            const {
                disruptionID,
                scenarioKey,
                rejectedScenarios
            } = req.data;


            const disruption =
                await SELECT.one
                    .from('resilink.Disruptions')
                    .where({
                        ID:
                            disruptionID
                    });


            if (!disruption) {

                return JSON.stringify({
                    error:
                        'Disruption not found'
                });
            }


            let rejectedKeys = [];

            try {

                rejectedKeys =
                    rejectedScenarios
                        ? JSON.parse(
                            rejectedScenarios
                        )
                        : [];

            } catch (error) {

                rejectedKeys = [];
            }


            // Rebuild the same decision that the user approved.
            const analysis =
                await buildAnalysis(
                    disruptionID,
                    rejectedKeys
                );


            const scenario =
                (analysis.scenarios || [])
                    .find(
                        item =>
                            item.key ===
                            scenarioKey
                    );


            if (!scenario) {

                return JSON.stringify({
                    error:
                        'Approved recovery scenario could not be found.'
                });
            }


            const execution =
                await applyRecoveryScenario(
                    scenario,
                    analysis
                );


            await UPDATE(
                'resilink.Disruptions'
            )
                .set({
                    status:
                        'Recovery Approved'
                })
                .where({
                    ID:
                        disruptionID
                });


            return JSON.stringify({

                message:
                    execution.message,

                disruptionID,

                scenarioKey,

                scenarioType:
                    scenario.type,

                status:
                    'Recovery Approved',

                applied:
                    execution.applied,

                coverage:
                    scenario.coverage || 0
            });
        }
    );


    // ======================================================
    // REJECT → NEXT APPROACH
    // ======================================================

    this.on(
        'rejectRecovery',
        async req => {

            const {
                disruptionID,
                rejectedScenarios
            } = req.data;


            let rejectedKeys = [];


            try {

                rejectedKeys =
                    rejectedScenarios
                        ? JSON.parse(
                            rejectedScenarios
                        )
                        : [];

            } catch (error) {

                rejectedKeys = [];
            }


            const analysis =
                await buildAnalysis(
                    disruptionID,
                    rejectedKeys
                );


            // ----------------------------------------------
            // Still have alternatives
            // ----------------------------------------------

            if (
                analysis.recommendation
            ) {

                return JSON.stringify(
                    analysis
                );
            }


            // ----------------------------------------------
            // No alternatives left
            // ----------------------------------------------

            await UPDATE(
                'resilink.Disruptions'
            )
                .set({
                    status:
                        'Recovery Rejected'
                })
                .where({
                    ID:
                        disruptionID
                });


            return JSON.stringify({

                message:
                    'No additional recovery option is available.',

                status:
                    'Recovery Rejected',

                noAlternatives:
                    true
            });
        }
    );


    // ======================================================
    // RESET DEMO SCENARIO
    // ======================================================

    this.on(
        'resetDemo',
        async req => {

            // Restore plants.
            await UPDATE(
                'resilink.Plants'
            )
                .set({
                    availableCapacity: 50
                })
                .where({
                    ID: 'plant-001'
                });

            await UPDATE(
                'resilink.Plants'
            )
                .set({
                    availableCapacity: 80
                })
                .where({
                    ID: 'plant-002'
                });

            await UPDATE(
                'resilink.Plants'
            )
                .set({
                    availableCapacity: 100
                })
                .where({
                    ID: 'plant-003'
                });

            // Restore inventory.
            await UPDATE(
                'resilink.Inventory'
            )
                .set({
                    quantity: 200
                })
                .where({
                    ID: 'inv-001'
                });

            await UPDATE(
                'resilink.Inventory'
            )
                .set({
                    quantity: 150
                })
                .where({
                    ID: 'inv-002'
                });

            await UPDATE(
                'resilink.Inventory'
            )
                .set({
                    quantity: 300
                })
                .where({
                    ID: 'inv-003'
                });

            // Restore supplier capacity.
            await UPDATE(
                'resilink.Suppliers'
            )
                .set({
                    capacity: 40
                })
                .where({
                    ID: 'sup-001'
                });

            await UPDATE(
                'resilink.Suppliers'
            )
                .set({
                    capacity: 60
                })
                .where({
                    ID: 'sup-002'
                });

            await UPDATE(
                'resilink.Suppliers'
            )
                .set({
                    capacity: 100
                })
                .where({
                    ID: 'sup-003'
                });

            // Restore disruption statuses.
            await UPDATE(
                'resilink.Disruptions'
            )
                .set({
                    status: 'Open'
                })
                .where({
                    ID: 'dis-001'
                });

            await UPDATE(
                'resilink.Disruptions'
            )
                .set({
                    status: 'Open'
                })
                .where({
                    ID: 'dis-002'
                });

            return JSON.stringify({
                message:
                    'Resilink demo scenario reset successfully.',
                disruptionID:
                    'dis-001',
                status:
                    'Open',
                plants: {
                    'plant-001':
                        '50 available',
                    'plant-002':
                        '80 available',
                    'plant-003':
                        '100 available'
                },
                inventory: {
                    'inv-001': 200,
                    'inv-002': 150,
                    'inv-003': 300
                },
                suppliers: {
                    'sup-001': 40,
                    'sup-002': 60,
                    'sup-003': 100
                }
            });
        }
    );


});