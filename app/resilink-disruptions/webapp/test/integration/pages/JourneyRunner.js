sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"com/resilink/disruptions/resilinkdisruptions/test/integration/pages/DisruptionsList.gen",
	"com/resilink/disruptions/resilinkdisruptions/test/integration/pages/DisruptionsObjectPage.gen"
], function (JourneyRunner, DisruptionsListGenerated, DisruptionsObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('com/resilink/disruptions/resilinkdisruptions') + '/test/flp.html#app-preview',
        pages: {
			onTheDisruptionsListGenerated: DisruptionsListGenerated,
			onTheDisruptionsObjectPageGenerated: DisruptionsObjectPageGenerated
        },
        async: true
    });

    return runner;
});

