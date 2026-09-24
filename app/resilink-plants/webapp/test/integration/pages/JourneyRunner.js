sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"com/resilink/plants/resilinkplants/test/integration/pages/PlantsList.gen",
	"com/resilink/plants/resilinkplants/test/integration/pages/PlantsObjectPage.gen"
], function (JourneyRunner, PlantsListGenerated, PlantsObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('com/resilink/plants/resilinkplants') + '/test/flp.html#app-preview',
        pages: {
			onThePlantsListGenerated: PlantsListGenerated,
			onThePlantsObjectPageGenerated: PlantsObjectPageGenerated
        },
        async: true
    });

    return runner;
});

