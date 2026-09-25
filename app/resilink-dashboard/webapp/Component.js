sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/odata/v4/ODataModel",
    "com/resilink/dashboard/resilinkdashboard/model/models"
], (
    UIComponent,
    ODataModel,
    models
) => {
    "use strict";

    return UIComponent.extend(
        "com.resilink.dashboard.resilinkdashboard.Component",
        {

            metadata: {
                manifest: "json",
                interfaces: [
                    "sap.ui.core.IAsyncContentCreation"
                ]
            },

            init() {

                UIComponent.prototype.init.apply(this, arguments);

                // Device model
                this.setModel(
                    models.createDeviceModel(),
                    "device"
                );

                // Connect dashboard to CAP OData service
                const oDataModel = new ODataModel({
                    serviceUrl: "/resilink/",
                    synchronizationMode: "None",
                    operationMode: "Server",
                    autoExpandSelect: true,
                    earlyRequests: true
                });

                // Set OData model as the default model
                this.setModel(oDataModel);

                console.log("RESILINK: OData model connected");
                console.log("RESILINK: Service URL = /resilink/");

                this.getRouter().initialize();
            }
        }
    );
});