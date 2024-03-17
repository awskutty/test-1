var modPath = '../../../../node_modules/';
var reqExpress = require('express');
var router = reqExpress.Router();
var request = require('request');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var servicename = 'CallExternalApi';
var objLogInfo;
router.post('/CallExternalApi', function (appRequest, appResponse) {
    try {
        var serviceModel = DBInstance.DBInstanceSession['SERVICE_MODEL'];
        reqInstanceHelper.PrintInfo(servicename, 'Begin', objLogInfo);
        var pHeaders = appRequest.headers;
        DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
            // Handle the close event when client close the connection
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });
            gettenantsetup();

            function gettenantsetup() {
                try {

                    var ClientID = appRequest.body.PARAMS.CLIENT_ID;
                    var tenantID = appRequest.body.PARAMS.TENANT_ID;
                    var Category = appRequest.body.PARAMS.CATEGORY;
                    var Apidata = appRequest.body.PARAMS.API_DATA;
                    var Searchparam = appRequest.body.PARAMS.SEARCHPARAM;
                    var apiname = "";
                    var apimethod = "";
                    var apiurl = "";
                    reqInstanceHelper.PrintInfo(servicename, 'gettenantsetup function called', objLogInfo);
                    reqInstanceHelper.PrintInfo(servicename, 'Query TENANT_SETUP table  with category is ', objLogInfo);

                    if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                        var cond = {};
                        cond.setup_code = Category;
                        reqsvchelper.GetSetupJson(pClient, cond, objLogInfo, function (res) {
                            if (res.Status == 'SUCCESS' && res.Data.length) {
                                aftergetsetupJson(res.Data);
                            } else {
                                return reqInstanceHelper.SendResponse(servicename, appResponse, null, objLogInfo, res.ErrorCode, res.ErrorMsg, res.Error);
                            }
                        });
                    } else {
                        DBInstance.GetTableFromFXDB(pClient, 'TENANT_SETUP', [], {
                            'CLIENT_ID': ClientID,
                            'TENANT_ID': tenantID,
                            'CATEGORY': Category
                        }, objLogInfo, function (err, result) {
                            try {
                                if (err) {
                                    return reqInstanceHelper.SendResponse(servicename, appResponse, '', objLogInfo, 'ERR-AUTH-16001', 'error while execute tenat_setup select query', err, 'FAILURE', '');
                                } else {
                                    if (result.rows.length > 0) {
                                        aftergetsetupJson(result.rows);
                                    } else {
                                        reqInstanceHelper.SendResponse(servicename, appResponse, '', objLogInfo, '', 'No Rows Found in Tenant_setup for ByPassSignIn', '', 'FAILURE', '');
                                    }
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(servicename, appResponse, '', objLogInfo, 'ERR-AUTH-16002', 'Exception occured while execute tenat_setup select query', error, 'FAILURE', '');
                            }
                        });
                    }


                    function aftergetsetupJson(result) {
                        reqInstanceHelper.PrintInfo(servicename, 'Got Rows from tenant_setup', objLogInfo);
                        var setupjson = result[0].setup_json;
                        var parseddata = JSON.parse(setupjson);
                        if (parseddata.API_CODE.length > 0) {
                            parseddata.API_CODE.forEach(function (apiparam) {
                                if (apiparam.NAME == Apidata) {
                                    apiname = apiparam.NAME;
                                    apimethod = apiparam.METHOD;
                                    apiurl = apiparam.URL;
                                }
                            });
                        }
                        //var api = parseddata[Apidata];
                        if (Searchparam != undefined && Searchparam != "") {
                            var condition_param = '';
                            if (Searchparam.length > 0) {
                                Searchparam.forEach(function (param) {
                                    condition_param = condition_param + param.BINDING_NAME + "=" + param.VALUE + "&";
                                });
                                var api_url = apiurl + "?" + condition_param;
                                console.log("Loop" + api_url);
                            }

                        }
                        console.log("Outside Loop" + apiurl);
                        var options = {
                            //url: 'http://edistrict.tn.gov.in:8080/eDistrict_postServices_SSO/resources/service/GetMobileForCas/',
                            //url:'https://www.cmsuat.co.in/ChennaiCSC/GetMobileNo.aspx',
                            url: apiurl,
                            method: apimethod,
                            "rejectUnauthorized": false,
                            form: '',
                            headers: {
                                "Content-Type": "application/json",
                                "session-id": pHeaders['session-id'],
                                "routingkey": pHeaders['routingkey']
                            }
                        };
                        request(options, function (error, response, body) {
                            if (err) {
                                reqInstanceHelper.SendResponse(servicename, appResponse, response, objLogInfo, '', '', '', error, '');
                            } else {
                                var res = body;
                                reqInstanceHelper.SendResponse(servicename, appResponse, res, objLogInfo, '', '', '', 'SUCCESS', '');
                            }
                        });

                    }
                } catch (error) {
                    reqInstanceHelper.SendResponse(servicename, appResponse, '', objLogInfo, 'ERR-AUTH-16003', 'Exception occured while execute tenat_setup select query', error, 'FAILURE', '');
                }

            }
        });

    } catch (error) {
        appResponse.send('Exception Occured ' + error);
    }
});
module.exports = router;