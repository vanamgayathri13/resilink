sap.ui.define([
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (MessageBox, MessageToast) {

    "use strict";

    // ==========================================
    // APPROVE / REJECT RECOVERY HELPER
    // ==========================================

    async function onRecoveryDecision(
        model,
        disruptionID,
        actionName
    ) {

        try {

            console.log(
                "Calling backend action:",
                actionName,
                "for disruption:",
                disruptionID
            );

            // Bind CAP backend action
            const action = model.bindContext(
                "/" + actionName + "(...)"
            );

            action.setParameter(
                "disruptionID",
                disruptionID
            );

            // Execute backend action
            await action.execute();

            // Read backend response
            const result =
                action.getBoundContext().getObject();

            const response =
                typeof result.value === "string"
                    ? JSON.parse(result.value)
                    : result.value || result;

            console.log("Backend response:", response);

            // Check backend error
            if (response.error) {

                MessageBox.error(response.error);
                return;

            }

            // ======================================
            // SHOW SUCCESS MESSAGE
            // ======================================

            MessageBox.success(
                (response.message ||
                    "Recovery decision saved") +

                "\n\nUpdated Status: " +

                (response.status || "Updated"),

                {
                    title: "RESILINK - Recovery Decision"
                }
            );

            MessageToast.show(
                "Recovery status updated successfully"
            );

        } catch (error) {

            console.error(
                "RESILINK Recovery Decision Error:",
                error
            );

            MessageBox.error(
                "Recovery action failed.\n\n" +
                (error.message ||
                    "Please check the backend.")
            );

        }
    }


    // ==========================================
    // MAIN CONTROLLER
    // ==========================================

    return {

        // ==========================================
        // 1. ANALYZE DISRUPTION
        // ==========================================

        onAnalyzeDisruption: async function (
            oContext,
            aSelectedContexts
        ) {

            try {

                // Check selected disruption
                if (
                    !aSelectedContexts ||
                    aSelectedContexts.length === 0
                ) {

                    MessageBox.warning(
                        "Please select a disruption first."
                    );

                    return;

                }

                // Get selected disruption details
                const selectedContext =
                    aSelectedContexts[0];

                const disruption =
                    selectedContext.getObject();

                const model =
                    selectedContext.getModel();


                // ======================================
                // CALL BACKEND ANALYSIS
                // ======================================

                const action = model.bindContext(
                    "/analyzeDisruption(...)"
                );

                action.setParameter(
                    "disruptionID",
                    disruption.ID
                );

                await action.execute();

                const result =
                    action.getBoundContext().getObject();

                const analysis =
                    typeof result.value === "string"
                        ? JSON.parse(result.value)
                        : result.value || result;


                // Check analysis error
                if (analysis.error) {

                    MessageBox.error(analysis.error);
                    return;

                }


                // ======================================
                // FORMAT ALLOCATION DETAILS
                // ======================================

                const allocationDetails =
                    (analysis.alternatives || [])

                        .filter(
                            plant =>
                                plant.recommendedAllocation > 0
                        )

                        .map(
                            plant =>
                                plant.plant +
                                " (" + plant.location + ")" +

                                "\nRecommended Allocation: " +

                                plant.recommendedAllocation +
                                " units"
                        )

                        .join("\n\n");


                const allocationText =
                    allocationDetails ||
                    "No alternative capacity available.";


                // ======================================
                // RECOVERY STATUS
                // ======================================

                const recoveryStatus =
                    analysis.recoveryStatus ||
                    "Awaiting Approval";


                // ======================================
                // SET POPUP ACTIONS
                // ======================================

                let popupActions;

                if (
                    recoveryStatus === "Awaiting Approval"
                ) {

                    popupActions = [
                        "Approve Recovery",
                        "Reject Recovery",
                        MessageBox.Action.CLOSE
                    ];

                } else {

                    // No approval actions for other statuses
                    popupActions = [
                        MessageBox.Action.CLOSE
                    ];

                }


                // ======================================
                // SHOW RECOVERY ANALYSIS POPUP
                // ======================================

                MessageBox.show(

                    "Affected Plant: " +
                    analysis.affectedPlant +

                    "\nProduction Shortage: " +
                    analysis.shortage + " units" +

                    "\n\nSMART RECOVERY ALLOCATION\n" +

                    allocationText +

                    "\n\nTotal Allocated: " +

                    (analysis.totalAllocated ?? 0) +
                    " units" +

                    "\nRemaining Shortage: " +

                    (
                        analysis.remainingShortage ??
                        analysis.shortage
                    ) +

                    " units" +

                    "\n\nRecovery Status: " +
                    recoveryStatus,

                    {
                        title: "RESILINK - Recovery Approval",

                        actions: popupActions,

                        emphasizedAction:
                            recoveryStatus === "Awaiting Approval"
                                ? "Approve Recovery"
                                : MessageBox.Action.CLOSE,


                        // ======================================
                        // HANDLE APPROVE / REJECT
                        // ======================================

                        onClose: async function (selectedAction) {

                            console.log(
                                "RESILINK selected action:",
                                selectedAction
                            );


                            // ==================================
                            // APPROVE RECOVERY
                            // ==================================

                            if (
                                selectedAction === "Approve Recovery"
                            ) {

                                await onRecoveryDecision(
                                    model,
                                    disruption.ID,
                                    "approveRecovery"
                                );

                            }


                            // ==================================
                            // REJECT RECOVERY
                            // ==================================

                            else if (
                                selectedAction === "Reject Recovery"
                            ) {

                                await onRecoveryDecision(
                                    model,
                                    disruption.ID,
                                    "rejectRecovery"
                                );

                            }

                        }

                    }

                );

            } catch (error) {

                console.error(
                    "RESILINK Analysis Error:",
                    error
                );

                MessageBox.error(
                    "Analysis failed: " +
                    (error.message ||
                        "Please check the backend.")
                );

            }

        }

    };

});