sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox"
], (Controller, MessageBox) => {

    "use strict";

    return Controller.extend(
        "com.resilink.dashboard.resilinkdashboard.controller.Dashboard",
        {

            // =====================================================
            // INITIALIZE DASHBOARD
            // =====================================================

            onInit() {

                console.log(
                    "RESILINK Dashboard initialized"
                );

                this._loadDashboardData();

            },


            // =====================================================
            // LOAD DASHBOARD DATA
            // =====================================================

            async _loadDashboardData() {

                try {

                    const oModel =
                        this.getOwnerComponent().getModel();


                    if (!oModel) {

                        console.error(
                            "RESILINK: OData model not found."
                        );

                        return;

                    }


                    console.log(
                        "RESILINK: OData model found."
                    );

                    console.log(
                        "RESILINK: Loading backend data..."
                    );


                    // =================================================
                    // LOAD DISRUPTIONS
                    // =================================================

                    const oDisruptionBinding =
                        oModel.bindList(
                            "/Disruptions"
                        );


                    const aDisruptionContexts =
                        await oDisruptionBinding.requestContexts(
                            0,
                            100
                        );


                    const aDisruptions =
                        aDisruptionContexts.map(
                            (oContext) =>
                                oContext.getObject()
                        );


                    // =================================================
                    // LOAD PLANTS
                    // =================================================

                    const oPlantBinding =
                        oModel.bindList(
                            "/Plants"
                        );


                    const aPlantContexts =
                        await oPlantBinding.requestContexts(
                            0,
                            100
                        );


                    const aPlants =
                        aPlantContexts.map(
                            (oContext) =>
                                oContext.getObject()
                        );


                    // =================================================
                    // DEBUG
                    // =================================================

                    console.log(
                        "RESILINK Disruptions:",
                        aDisruptions
                    );


                    console.log(
                        "RESILINK Plants:",
                        aPlants
                    );


                    // =================================================
                    // FIND ACTIVE DISRUPTIONS
                    // =================================================

                    const aActiveDisruptions =
                        aDisruptions.filter(
                            (oDisruption) => {

                                const sStatus =
                                    String(
                                        oDisruption.status || ""
                                    ).toLowerCase();

                                return (
                                    sStatus === "open"
                                );

                            }
                        );


                    // =================================================
                    // ACTIVE DISRUPTION COUNT
                    // =================================================

                    const iActiveDisruptions =
                        aActiveDisruptions.length;


                    // =================================================
                    // UNITS AT RISK
                    // =================================================

                    const iUnitsAtRisk =
                        aActiveDisruptions.reduce(
                            (
                                iTotal,
                                oDisruption
                            ) => {

                                return (
                                    iTotal +
                                    Number(
                                        oDisruption.affectedQuantity || 0
                                    )
                                );

                            },
                            0
                        );


                    // =================================================
                    // MAIN DISRUPTION
                    // =================================================

                    let oMainDisruption = null;

                    let oAffectedPlant = null;


                    if (
                        aActiveDisruptions.length > 0
                    ) {

                        oMainDisruption =
                            aActiveDisruptions[0];


                        const sPlantID =
                            oMainDisruption.plant_ID;


                        oAffectedPlant =
                            aPlants.find(
                                (oPlant) =>
                                    oPlant.ID === sPlantID
                            );

                    }


                    // =================================================
                    // RECOVERY OPTIONS
                    // =================================================

                    let iRecoveryOptions = 0;


                    if (oAffectedPlant) {

                        iRecoveryOptions =
                            aPlants.filter(
                                (oPlant) => {

                                    return (

                                        oPlant.ID !==
                                        oAffectedPlant.ID

                                        &&

                                        Number(
                                            oPlant.availableCapacity || 0
                                        ) > 0

                                    );

                                }
                            ).length;

                    }


                    // =================================================
                    // UPDATE KPI CARDS
                    // =================================================

                    this._updateDashboardKPIs(

                        iActiveDisruptions,

                        iUnitsAtRisk,

                        oAffectedPlant,

                        oMainDisruption,

                        iRecoveryOptions

                    );


                    // =================================================
                    // UPDATE NETWORK CAPACITY
                    // =================================================

                    this._updateNetworkCapacity(
                        aPlants
                    );


                    // =================================================
                    // UPDATE RECOVERY INTELLIGENCE
                    // =================================================

                    this._updateRecoveryIntelligence(
                        aPlants,
                        oAffectedPlant
                    );


                    // =================================================
                    // LOAD RECOVERY DECISION
                    // =================================================

                    if (oMainDisruption) {

                        await this._loadRecoveryDecision(
                            oModel,
                            oMainDisruption
                        );

                    } else {

                        this._resetRecoveryDecision();

                    }


                    // =================================================
                    // SUCCESS
                    // =================================================

                    console.log(
                        "RESILINK Dashboard data loaded successfully"
                    );


                } catch (oError) {

                    console.error(
                        "RESILINK Dashboard Error:",
                        oError
                    );

                }

            },


            // =====================================================
            // LOAD RECOVERY DECISION
            // =====================================================

            async _loadRecoveryDecision(
                oModel,
                oDisruption
            ) {

                try {

                    console.log(
                        "RESILINK: Analyzing disruption:",
                        oDisruption.ID
                    );


                    // =================================================
                    // CALL CAP ACTION
                    // =================================================

                    const oAction =
                        oModel.bindContext(
                            "/analyzeDisruption(...)"
                        );


                    oAction.setParameter(
                        "disruptionID",
                        oDisruption.ID
                    );


                    await oAction.execute();


                    // =================================================
                    // GET RESULT
                    // =================================================

                    const oResult =
                        oAction
                            .getBoundContext()
                            .getObject();


                    console.log(
                        "RESILINK Recovery Analysis:",
                        oResult
                    );


                    // =================================================
                    // PARSE RESULT
                    // =================================================

                    let oAnalysis;


                    if (
                        oResult &&
                        typeof oResult.value === "string"
                    ) {

                        oAnalysis =
                            JSON.parse(
                                oResult.value
                            );

                    } else {

                        oAnalysis =
                            oResult.value ||
                            oResult;

                    }


                    // =================================================
                    // CHECK ERROR
                    // =================================================

                    if (
                        oAnalysis &&
                        oAnalysis.error
                    ) {

                        console.error(
                            "RESILINK Recovery Analysis Error:",
                            oAnalysis.error
                        );

                        return;

                    }


                    // =================================================
                    // SHORTAGE
                    // =================================================

                    const iShortage =
                        Number(
                            oAnalysis.shortage || 0
                        );


                    // =================================================
                    // ALTERNATIVES
                    // =================================================

                    const aAlternatives =
                        oAnalysis.alternatives || [];


                    // =================================================
                    // RECOMMENDED ALLOCATIONS
                    // =================================================

                    const aRecommendedAllocations =
                        aAlternatives.filter(
                            (oPlant) =>
                                Number(
                                    oPlant.recommendedAllocation || 0
                                ) > 0
                        );


                    // =================================================
                    // ALLOCATION TEXT
                    // =================================================

                    let sAllocationText =
                        "No alternative capacity available.";


                    if (
                        aRecommendedAllocations.length > 0
                    ) {

                        sAllocationText =
                            aRecommendedAllocations
                                .map(
                                    (oPlant) => {

                                        return (
                                            oPlant.plant +
                                            " → " +
                                            oPlant.recommendedAllocation +
                                            " Units"
                                        );

                                    }
                                )
                                .join(" | ");

                    }


                    // =================================================
                    // TOTAL ALLOCATED
                    // =================================================

                    const iTotalAllocated =
                        Number(
                            oAnalysis.totalAllocated || 0
                        );


                    // =================================================
                    // REMAINING SHORTAGE
                    // =================================================

                    const iRemainingShortage =
                        Number(
                            oAnalysis.remainingShortage || 0
                        );


                    // =================================================
                    // UPDATE UI
                    // =================================================

                    this._updateRecoveryDecision(

                        iShortage,

                        sAllocationText,

                        iTotalAllocated,

                        iRemainingShortage,

                        oAnalysis.recoveryStatus

                    );


                    console.log(
                        "RESILINK: Recovery Decision updated successfully"
                    );


                } catch (oError) {

                    console.error(
                        "RESILINK Recovery Decision Error:",
                        oError
                    );

                }

            },


            // =====================================================
            // APPROVE RECOVERY
            // =====================================================

            async onApproveRecovery() {

                try {

                    console.log(
                        "RESILINK: Approve Recovery clicked"
                    );


                    const oModel =
                        this.getOwnerComponent().getModel();


                    if (!oModel) {

                        MessageBox.error(
                            "OData model is not available."
                        );

                        return;

                    }


                    // =================================================
                    // GET DISRUPTIONS
                    // =================================================

                    const oBinding =
                        oModel.bindList(
                            "/Disruptions"
                        );


                    const aContexts =
                        await oBinding.requestContexts(
                            0,
                            100
                        );


                    const aDisruptions =
                        aContexts.map(
                            (oContext) =>
                                oContext.getObject()
                        );


                    // =================================================
                    // FIND OPEN DISRUPTION
                    // =================================================

                    const oDisruption =
                        aDisruptions.find(
                            (oItem) =>
                                String(
                                    oItem.status || ""
                                ).toLowerCase() === "open"
                        );


                    if (!oDisruption) {

                        MessageBox.warning(
                            "No active disruption is available for approval."
                        );

                        return;

                    }


                    // =================================================
                    // EXECUTE APPROVAL
                    // =================================================

                    await this._executeRecoveryDecision(
                        oModel,
                        oDisruption.ID,
                        "approveRecovery"
                    );


                } catch (oError) {

                    console.error(
                        "RESILINK Approval Error:",
                        oError
                    );

                    MessageBox.error(
                        "Unable to approve the recovery recommendation."
                    );

                }

            },


            // =====================================================
            // REJECT RECOVERY
            // =====================================================

            async onRejectRecovery() {

                try {

                    console.log(
                        "RESILINK: Reject Recovery clicked"
                    );


                    const oModel =
                        this.getOwnerComponent().getModel();


                    if (!oModel) {

                        MessageBox.error(
                            "OData model is not available."
                        );

                        return;

                    }


                    // =================================================
                    // GET DISRUPTIONS
                    // =================================================

                    const oBinding =
                        oModel.bindList(
                            "/Disruptions"
                        );


                    const aContexts =
                        await oBinding.requestContexts(
                            0,
                            100
                        );


                    const aDisruptions =
                        aContexts.map(
                            (oContext) =>
                                oContext.getObject()
                        );


                    // =================================================
                    // FIND OPEN DISRUPTION
                    // =================================================

                    const oDisruption =
                        aDisruptions.find(
                            (oItem) =>
                                String(
                                    oItem.status || ""
                                ).toLowerCase() === "open"
                        );


                    if (!oDisruption) {

                        MessageBox.warning(
                            "No active disruption is available for rejection."
                        );

                        return;

                    }


                    // =================================================
                    // EXECUTE REJECTION
                    // =================================================

                    await this._executeRecoveryDecision(
                        oModel,
                        oDisruption.ID,
                        "rejectRecovery"
                    );


                } catch (oError) {

                    console.error(
                        "RESILINK Rejection Error:",
                        oError
                    );

                    MessageBox.error(
                        "Unable to reject the recovery recommendation."
                    );

                }

            },


            // =====================================================
            // EXECUTE RECOVERY DECISION
            // =====================================================

            async _executeRecoveryDecision(
                oModel,
                sDisruptionID,
                sActionName
            ) {

                try {

                    console.log(
                        "RESILINK: Executing action:",
                        sActionName,
                        "for disruption:",
                        sDisruptionID
                    );


                    // =================================================
                    // CREATE CAP ACTION
                    // =================================================

                    const oAction =
                        oModel.bindContext(
                            "/" +
                            sActionName +
                            "(...)"
                        );


                    // =================================================
                    // SET DISRUPTION ID
                    // =================================================

                    oAction.setParameter(
                        "disruptionID",
                        sDisruptionID
                    );


                    // =================================================
                    // EXECUTE ACTION
                    // =================================================

                    await oAction.execute();


                    // =================================================
                    // GET RESULT
                    // =================================================

                    const oResult =
                        oAction
                            .getBoundContext()
                            .getObject();


                    console.log(
                        "RESILINK Recovery Action Result:",
                        oResult
                    );


                    // =================================================
                    // SUCCESS MESSAGE
                    // =================================================

                    if (
                        sActionName === "approveRecovery"
                    ) {

                        MessageBox.success(
                            "Recovery has been approved successfully."
                        );

                    } else {

                        MessageBox.warning(
                            "Recovery recommendation has been rejected."
                        );

                    }


                    // =================================================
                    // RELOAD DASHBOARD
                    // =================================================

                    await this._loadDashboardData();


                } catch (oError) {

                    console.error(
                        "RESILINK Recovery Action Error:",
                        oError
                    );

                    throw oError;

                }

            },


            // =====================================================
            // UPDATE RECOVERY INTELLIGENCE
            // =====================================================

            _updateRecoveryIntelligence(
                aPlants,
                oAffectedPlant
            ) {

                const oView =
                    this.getView();


                // =================================================
                // FIND ALTERNATIVE PLANTS
                // =================================================

                const aAlternativePlants =
                    aPlants.filter(
                        (oPlant) => {

                            return (

                                (
                                    !oAffectedPlant ||

                                    oPlant.ID !==
                                    oAffectedPlant.ID
                                )

                                &&

                                Number(
                                    oPlant.availableCapacity || 0
                                ) > 0

                            );

                        }
                    );


                console.log(
                    "RESILINK Recovery Intelligence:",
                    aAlternativePlants
                );


                // =================================================
                // PLANT B
                // =================================================

                const oPlantB =
                    aAlternativePlants.find(
                        (oPlant) =>
                            oPlant.name === "Plant B"
                    );


                const oPlantBName =
                    oView.byId(
                        "recoveryPlantBName"
                    );


                const oPlantBLocation =
                    oView.byId(
                        "recoveryPlantBLocation"
                    );


                const oPlantBAvailability =
                    oView.byId(
                        "recoveryPlantBAvailability"
                    );


                if (oPlantB) {

                    if (oPlantBName) {

                        oPlantBName.setText(
                            oPlantB.name
                        );

                    }


                    if (oPlantBLocation) {

                        oPlantBLocation.setText(
                            oPlantB.location
                        );

                    }


                    if (oPlantBAvailability) {

                        const iCapacity =
                            Number(
                                oPlantB.availableCapacity || 0
                            );


                        oPlantBAvailability.setText(
                            iCapacity +
                            " units available"
                        );


                        oPlantBAvailability.setState(
                            iCapacity > 0
                                ? "Success"
                                : "Error"
                        );

                    }

                } else {

                    if (oPlantBAvailability) {

                        oPlantBAvailability.setText(
                            "No capacity available"
                        );


                        oPlantBAvailability.setState(
                            "Error"
                        );

                    }

                }


                // =================================================
                // PLANT C
                // =================================================

                const oPlantC =
                    aAlternativePlants.find(
                        (oPlant) =>
                            oPlant.name === "Plant C"
                    );


                const oPlantCName =
                    oView.byId(
                        "recoveryPlantCName"
                    );


                const oPlantCLocation =
                    oView.byId(
                        "recoveryPlantCLocation"
                    );


                const oPlantCAvailability =
                    oView.byId(
                        "recoveryPlantCAvailability"
                    );


                if (oPlantC) {

                    if (oPlantCName) {

                        oPlantCName.setText(
                            oPlantC.name
                        );

                    }


                    if (oPlantCLocation) {

                        oPlantCLocation.setText(
                            oPlantC.location
                        );

                    }


                    if (oPlantCAvailability) {

                        const iCapacity =
                            Number(
                                oPlantC.availableCapacity || 0
                            );


                        oPlantCAvailability.setText(
                            iCapacity +
                            " units available"
                        );


                        oPlantCAvailability.setState(
                            iCapacity > 0
                                ? "Success"
                                : "Error"
                        );

                    }

                } else {

                    if (oPlantCAvailability) {

                        oPlantCAvailability.setText(
                            "No capacity available"
                        );


                        oPlantCAvailability.setState(
                            "Error"
                        );

                    }

                }

            },


            // =====================================================
            // UPDATE RECOVERY DECISION UI
            // =====================================================

            _updateRecoveryDecision(

                iShortage,

                sAllocationText,

                iTotalAllocated,

                iRemainingShortage,

                sRecoveryStatus

            ) {

                const oView =
                    this.getView();


                // =================================================
                // SHORTAGE
                // =================================================

                const oShortage =
                    oView.byId(
                        "recoveryShortageValue"
                    );


                if (oShortage) {

                    oShortage.setText(
                        iShortage +
                        " Units"
                    );

                }


                // =================================================
                // ALLOCATION
                // =================================================

                const oAllocation =
                    oView.byId(
                        "recoveryAllocationValue"
                    );


                if (oAllocation) {

                    oAllocation.setText(
                        sAllocationText
                    );

                }


                // =================================================
                // STATUS
                // =================================================

                const oStatus =
                    oView.byId(
                        "recoveryDecisionStatus"
                    );


                if (oStatus) {

                    if (
                        iRemainingShortage === 0
                    ) {

                        oStatus.setText(
                            "FULLY COVERED"
                        );


                        oStatus.setState(
                            "Success"
                        );


                        oStatus.setIcon(
                            "sap-icon://accept"
                        );

                    } else {

                        oStatus.setText(
                            "SHORTAGE REMAINS"
                        );


                        oStatus.setState(
                            "Warning"
                        );


                        oStatus.setIcon(
                            "sap-icon://warning"
                        );

                    }

                }


                // =================================================
                // MESSAGE
                // =================================================

                const oMessage =
                    oView.byId(
                        "recoveryDecisionMessage"
                    );


                if (oMessage) {

                    if (
                        iRemainingShortage === 0
                    ) {

                        oMessage.setText(

                            "RESILINK identified sufficient alternative capacity to recover the full " +
                            iShortage +
                            "-unit shortage. " +
                            "Recommended allocation: " +
                            sAllocationText +
                            ". Final allocation requires planner approval."

                        );


                        oMessage.setType(
                            "Success"
                        );


                    } else {

                        oMessage.setText(

                            "RESILINK identified " +
                            iTotalAllocated +
                            " units of alternative capacity, but " +
                            iRemainingShortage +
                            " units of shortage remain. Additional recovery planning is required."

                        );


                        oMessage.setType(
                            "Warning"
                        );

                    }

                }


                console.log(
                    "RESILINK Recovery Status:",
                    sRecoveryStatus
                );

            },


            // =====================================================
            // RESET RECOVERY DECISION
            // =====================================================

            _resetRecoveryDecision() {

                const oView =
                    this.getView();


                const oShortage =
                    oView.byId(
                        "recoveryShortageValue"
                    );


                const oAllocation =
                    oView.byId(
                        "recoveryAllocationValue"
                    );


                const oStatus =
                    oView.byId(
                        "recoveryDecisionStatus"
                    );


                const oMessage =
                    oView.byId(
                        "recoveryDecisionMessage"
                    );


                if (oShortage) {

                    oShortage.setText(
                        "0 Units"
                    );

                }


                if (oAllocation) {

                    oAllocation.setText(
                        "No recovery required"
                    );

                }


                if (oStatus) {

                    oStatus.setText(
                        "NO ACTIVE DISRUPTION"
                    );


                    oStatus.setState(
                        "Success"
                    );


                    oStatus.setIcon(
                        "sap-icon://accept"
                    );

                }


                if (oMessage) {

                    oMessage.setText(
                        "The supply chain is currently operating without an active disruption."
                    );


                    oMessage.setType(
                        "Success"
                    );

                }

            },


            // =====================================================
            // UPDATE KPI CARDS
            // =====================================================

            _updateDashboardKPIs(

                iActiveDisruptions,

                iUnitsAtRisk,

                oAffectedPlant,

                oMainDisruption,

                iRecoveryOptions

            ) {

                const oView =
                    this.getView();


                // =================================================
                // ACTIVE DISRUPTIONS
                // =================================================

                const oActiveDisruptions =
                    oView.byId(
                        "activeDisruptionsValue"
                    );


                if (oActiveDisruptions) {

                    oActiveDisruptions.setText(

                        String(
                            iActiveDisruptions
                        ).padStart(2, "0")

                    );

                }


                // =================================================
                // UNITS AT RISK
                // =================================================

                const oUnitsAtRisk =
                    oView.byId(
                        "unitsAtRiskValue"
                    );


                if (oUnitsAtRisk) {

                    oUnitsAtRisk.setText(
                        String(
                            iUnitsAtRisk
                        )
                    );

                }


                // =================================================
                // AFFECTED PLANT
                // =================================================

                const oAffectedPlantValue =
                    oView.byId(
                        "affectedPlantValue"
                    );


                if (oAffectedPlantValue) {

                    oAffectedPlantValue.setText(

                        oAffectedPlant
                            ? oAffectedPlant.name
                            : "—"

                    );

                }


                // =================================================
                // AFFECTED PLANT DESCRIPTION
                // =================================================

                const oAffectedPlantStatus =
                    oView.byId(
                        "affectedPlantStatus"
                    );


                if (oAffectedPlantStatus) {

                    oAffectedPlantStatus.setText(

                        oMainDisruption

                            ? (
                                oMainDisruption.title ||
                                "Active disruption"
                            )

                            : "No active disruption"

                    );

                }


                // =================================================
                // RECOVERY OPTIONS
                // =================================================

                const oRecoveryOptions =
                    oView.byId(
                        "recoveryOptionsValue"
                    );


                if (oRecoveryOptions) {

                    oRecoveryOptions.setText(

                        String(
                            iRecoveryOptions
                        ).padStart(2, "0")

                    );

                }


                // =================================================
                // HERO ALERT
                // =================================================

                const oHeroAlert =
                    oView.byId(
                        "heroAlert"
                    );


                if (oHeroAlert) {

                    if (
                        iActiveDisruptions === 0
                    ) {

                        oHeroAlert.setText(
                            "Network operating normally"
                        );


                        oHeroAlert.setState(
                            "Success"
                        );


                    } else {

                        oHeroAlert.setText(

                            iActiveDisruptions === 1

                                ? "1 disruption requires attention"

                                : iActiveDisruptions +
                                  " disruptions require attention"

                        );


                        oHeroAlert.setState(
                            "Warning"
                        );

                    }

                }

            },


            // =====================================================
            // UPDATE NETWORK CAPACITY
            // =====================================================

            _updateNetworkCapacity(
                aPlants
            ) {

                aPlants.forEach(
                    (oPlant) => {


                        // ==========================================
                        // PLANT A
                        // ==========================================

                        if (
                            oPlant.name === "Plant A"
                        ) {

                            this._setCapacity(

                                "plantACapacityText",

                                "plantACapacityProgress",

                                oPlant

                            );

                        }


                        // ==========================================
                        // PLANT B
                        // ==========================================

                        if (
                            oPlant.name === "Plant B"
                        ) {

                            this._setCapacity(

                                "plantBCapacityText",

                                "plantBCapacityProgress",

                                oPlant

                            );

                        }


                        // ==========================================
                        // PLANT C
                        // ==========================================

                        if (
                            oPlant.name === "Plant C"
                        ) {

                            this._setCapacity(

                                "plantCCapacityText",

                                "plantCCapacityProgress",

                                oPlant

                            );

                        }

                    }
                );

            },


            // =====================================================
            // CAPACITY HELPER
            // =====================================================

            _setCapacity(

                sTextID,

                sProgressID,

                oPlant

            ) {

                const oView =
                    this.getView();


                const oText =
                    oView.byId(
                        sTextID
                    );


                const oProgress =
                    oView.byId(
                        sProgressID
                    );


                const iAvailable =
                    Number(
                        oPlant.availableCapacity || 0
                    );


                const iPlanned =
                    Number(
                        oPlant.plannedCapacity || 0
                    );


                let iPercentage = 0;


                if (
                    iPlanned > 0
                ) {

                    iPercentage =
                        Math.round(

                            (
                                iAvailable /
                                iPlanned
                            ) * 100

                        );

                }


                // =================================================
                // UPDATE CAPACITY TEXT
                // =================================================

                if (oText) {

                    oText.setText(

                        iAvailable +
                        " / " +
                        iPlanned +
                        " units"

                    );

                }


                // =================================================
                // UPDATE PROGRESS BAR
                // =================================================

                if (oProgress) {

                    oProgress.setPercentValue(
                        iPercentage
                    );


                    oProgress.setDisplayValue(

                        iPercentage +
                        "% available"

                    );


                    if (
                        iPercentage <= 50
                    ) {

                        oProgress.setState(
                            "Error"
                        );


                    } else {

                        oProgress.setState(
                            "Success"
                        );

                    }

                }

            }

        }

    );

});