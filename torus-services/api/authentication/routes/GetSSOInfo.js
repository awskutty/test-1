var reqExpress = require('express');
var router = reqExpress.Router();

var reqTranDBInstance = require("../../../../torus-references/instance/TranDBInstance");
var reqFXDBInstance = require("../../../../torus-references/instance/DBInstance");
var reqInstanceHelper = require("../../../../torus-references/common/InstanceHelper");
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');

router.post('/GetSSOInfo', function (appRequest, appResponse) {
    try {
        var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
        var objLogInfo = '';
        var systemInfo = {};
        var params = appRequest.body;
        var system = params.system.toUpperCase();
        var strtenantID = params.Tenant_Id;
        var strClientID = params.client_Id;


        reqFXDBInstance.GetFXDBConnection(appRequest.headers, 'clt_cas', null, function (session) {
            try {
                var cond = {};
                cond.setup_code = 'SSO_INFO';

                if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                    reqsvchelper.GetSetupJson(session, cond, objLogInfo, function (res) {
                        if (res.Status == 'SUCCESS' && res.Data.length) {
                            var tenantSetup = JSON.parse(res.Data[0].setup_json);
                            for (var i = 0; i < tenantSetup.length; i++) {
                                if (tenantSetup[i].SYSTEM == system) {
                                    systemInfo = tenantSetup[i];
                                    sendSystemDetails();
                                }
                            }
                        } else {
                            var data = {
                                process_status: "FAILED",
                                error: "Authentication Failed"
                            };
                            appResponse.send(data);
                        }
                    });
                } else {

                    var cond = {};
                    cond.client_id = strClientID ? strClientID : '0';
                    cond.tenant_id = strtenantID ? strtenantID : '0';
                    cond.category = 'SSO_INFO';
                    reqFXDBInstance.GetTableFromFXDB(session, 'tenant_setup', [], cond, objLogInfo, function (error, result) {
                        try {
                            if (!checkError(error)) {
                                if (result.rows.length > 0) {
                                    var tenantSetup = JSON.parse(result.rows[0].setup_json);
                                    for (var i = 0; i < tenantSetup.length; i++) {
                                        if (tenantSetup[i].SYSTEM == system) {
                                            systemInfo = tenantSetup[i];
                                            sendSystemDetails();
                                        }
                                    }

                                } else {
                                    var data = {
                                        process_status: "FAILED",
                                        error: "Authentication Failed"
                                    };
                                    appResponse.send(data);
                                }
                            } else {
                                var data = {
                                    process_status: "FAILED",
                                    error: "Authentication Failed"
                                };
                                appResponse.send(data);
                            }

                        } catch (error) {
                            appResponse.send(error);
                        }
                    });

                }




                function sendSystemDetails() {
                    var data = {
                        process_status: "SUCCESS",
                        service_status: "SUCCESS",
                        apiData: systemInfo
                    };

                    appResponse.send(data);
                }
                function checkError(error) {
                    if (error) {
                        var data = {
                            process_status: "FAILED",
                            service_status: "SUCCESS",
                            error: error
                        };
                        return appResponse.send(data);
                    } else {
                        return false;
                    }
                }

            } catch (error) {
                appResponse.send(error);
            }
        });
    } catch (error) {
        appResponse.send(error);
    }

});

module.exports = router;
