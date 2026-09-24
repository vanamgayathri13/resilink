sap.ui.define([
    "sap/m/MessageBox"
], function (MessageBox) {
    "use strict";

    return {
        onAnalyzeDisruption: async function (oContext, aSelectedContexts) {
            try {
                // Check if a disruption is selected
                if (!aSelectedContexts || aSelectedContexts.length === 0) {
                    MessageBox.warning("Please select a disruption first.");
                    return;
                }

                // Get selected disruption details
                const disruption = aSelectedContexts[0].getObject();
                const model = aSelectedContexts[0].getModel();

                // Call RESILINK CAP backend action
                const action = model.bindContext(
                    "/analyzeDisruption(...)"
                );

                action.setParameter("disruptionID", disruption.ID);

                await action.execute();

                // Get analysis result
                const result = action.getBoundContext().getObject();

                const analysis = typeof result.value === "string"
                    ? JSON.parse(result.value)
                    : result.value || result;

                // Get alternative plants
                const alternatives = (analysis.alternatives || [])
                    .map(function (plant) {
                        return plant.plant;
                    })
                    .join(", ");

                // Display recovery recommendation
                MessageBox.success(
                    "Affected Plant: " + analysis.affectedPlant +

                    "\nShortage: " + analysis.shortage + " units" +

                    "\nAlternative Plants: " + alternatives +

                    "\n\nRECOVERY RECOMMENDATION" +

                    "\nReallocate production to alternative plants." +

                    "\n\nRecovery Status: Awaiting Approval",

                    {
                        title: "RESILINK - Recovery Recommendation",
                        styleClass: "sapUiSizeCompact"
                    }
                );

            } catch (error) {
                console.error("RESILINK Analysis Error:", error);

                MessageBox.error(
                    "Analysis failed: " + error.message
                );
            }
        }
    };
});