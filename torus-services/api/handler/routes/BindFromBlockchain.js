var modPath = '../../../../node_modules/';
var reqExpress = require('express');
var router = reqExpress.Router();
var request = require('request');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var servicename = 'BindFromBlockchain';
var objLogInfo;
router.post('/BindFromBlockchain', function (appRequest, appResponse) {
    try {
        var serviceModel = DBInstance.DBInstanceSession['SERVICE_MODEL'];
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            reqInstanceHelper.PrintInfo(servicename, 'Begin', objLogInfo);
            var pHeaders = appRequest.headers;
            DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                // Handle the close event when client close the connection
                appResponse.on('close', function () { });
                appResponse.on('finish', function () { });
                appResponse.on('end', function () { });
                Preparedata();

                function Preparedata() {
                    try {


                        var parms = appRequest.body.PARAMS;
                        var reqobj = {
                            clt_cas_instance: pClient,
                            HL_SETUP: parms.HL_SETUP
                        };
                        gettenant_setup(reqobj, function (pdata) {
                            if (pdata.STATUS == "SUCCESS") {
                                var apiurl = pHeaders["origin"];
                                try {
                                    reqInstanceHelper.PrintInfo(servicename, 'query_chaincode function called', objLogInfo);
                                    var apiparams = AssignParams(parms);
                                    apiparams.channelName = pdata.data.HL_CHANNEL_NAME;
                                    apiparams.network_name = pdata.data.HL_NETWORK_NAME;
                                    apiparams.peers = pdata.data.HL_PEERS;
                                    apiparams.username = sessionInfo.USER_NAME;
                                    apiparams.org_name = sessionInfo.S_CODE;
                                    if (typeof apiparams == "string") {
                                        reqInstanceHelper.SendResponse(servicename, appResponse, apiparams, objLogInfo, '', '', '', 'FAILURE', '');
                                    } else {
                                        var options = {
                                            url: apiurl + '/BlockChain/query_chaincode/',
                                            method: "POST",
                                            "rejectUnauthorized": false,
                                            body: apiparams,
                                            json: true,
                                            headers: {
                                                "Content-Type": "application/json",
                                                "session-id": pHeaders['session-id'],
                                                "routingkey": pHeaders['routingkey']
                                            }
                                        };
                                        request(options, function (error, response, body) {
                                            if (error) {
                                                reqInstanceHelper.SendResponse(servicename, appResponse, response, objLogInfo, '', '', '', error, '');
                                            } else {
                                                result = [];
                                                if (parms.HL_FUNCTION_TYPE == 'QueryHistory' && body.data) {
                                                    body.data = JSON.parse(body.data);
                                                    body.data.forEach(function (data) {
                                                        var obj = {};
                                                        if (data["value"]) {
                                                            for (var pkey in data["Value"]) {
                                                                if (data["Value"].hasOwnProperty(pkey)) {
                                                                    obj[pkey] = data["Value"][pkey];
                                                                    obj[pkey] = data["Value"][pkey];
                                                                    obj[pkey] = data["Value"][pkey];
                                                                    obj[pkey] = data["Value"][pkey];
                                                                    obj[pkey] = data["Value"][pkey];
                                                                    obj["blk_id"] = data["TxId"];
                                                                }
                                                            }
                                                        } else {
                                                            obj = data["Record"];
                                                        }

                                                        result.push(obj);
                                                    });

                                                    body.data = result;

                                                } else if (parms.HL_FUNCTION_TYPE == 'QuerywithPaging') {
                                                    try {
                                                        body.data = JSON.parse(body.data);
                                                        body.data.forEach(function (data) {
                                                            var obj = {};
                                                            for (var pkey in data["Record"]) {
                                                                if (data["Record"].hasOwnProperty(pkey)) {
                                                                    obj[pkey] = data["Record"][pkey];
                                                                    obj[pkey] = data["Record"][pkey];
                                                                    obj[pkey] = data["Record"][pkey];
                                                                    obj[pkey] = data["Record"][pkey];
                                                                    obj[pkey] = data["Record"][pkey];
                                                                    obj["trn_id"] = data["Key"];
                                                                }
                                                            }
                                                            result.push(obj);
                                                        });

                                                        body.data = result;
                                                    } catch (e) {
                                                        console.log(e);
                                                        body.data = [];
                                                    }
                                                }
                                                var res = body;
                                                reqInstanceHelper.SendResponse(servicename, appResponse, res, objLogInfo, '', '', '', 'SUCCESS', '');
                                            }
                                        });
                                    }



                                } catch (error) {
                                    reqInstanceHelper.SendResponse(servicename, appResponse, '', objLogInfo, 'ERR-HAND-16002', 'Exception occured while execute tenat_setup select query', error, 'FAILURE', '');
                                }
                            }
                            else {
                                reqInstanceHelper.SendResponse(servicename, appResponse, '', objLogInfo, 'ERR-HAND-16002', pdata.data, "", 'FAILURE', '');
                            }
                        });
                    } catch (error) {
                        reqInstanceHelper.SendResponse(servicename, appResponse, '', objLogInfo, 'ERR-HAND-16003', 'Exception occured while execute tenat_setup select query', error, 'FAILURE', '');
                    }

                }

                function gettenant_setup(pparams, callback) {
                    if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                        var cond = {};
                        cond.setup_code = 'HL_SETUP';
                        reqsvchelper.GetSetupJson(pparams.clt_cas_instance, cond, objLogInfo, function (res) {
                            if (res.Status == 'SUCCESS' && res.Data.length) {
                                var Setupjson = JSON.parse(res.Data[0].setup_json);
                                var result = {
                                    "STATUS": "SUCCESS",
                                    "data": Setupjson
                                };
                                callback(result);
                            } else {
                                return reqInstanceHelper.SendResponse('BindFromBlockchain', appResponse, null, objLogInfo, res.ErrorCode, res.ErrorMsg, res.Error);
                            }
                        });
                    }
                    else {
                        var category = pparams["HL_SETUP"];
                        DBInstance.GetTableFromFXDB(pparams.clt_cas_instance, 'tenant_setup', [], {
                            'client_id': sessionInfo.CLIENT_ID,
                            'tenant_id': sessionInfo.TENANT_ID,
                            'category': category
                        }, objLogInfo, function (error, presult) {
                            if (!error) {
                                if (presult.rows.length > 0) {
                                    var result = {
                                        "STATUS": "SUCCESS",
                                        "data": JSON.parse(presult.rows[0].setup_json)
                                    };
                                    callback(result);
                                } else {
                                    var result = {
                                        "STATUS": "FAILURE",
                                        "data": "No Setup Found for Network Name"
                                    };
                                    callback(result);
                                }

                            } else {
                                var result = {
                                    "STATUS": "FAILURE",
                                    "data": error
                                };
                                callback(result);
                            }
                        });

                    }
                }
                function AssignParams(pdata) {
                    var resparams = {};

                    if (pdata.HL_FUNCTION_TYPE == 'QueryHistory') {
                        if (pdata.FILTERS.length < 1) {
                            if (pdata.KEY_VALUE != 0) {
                                resparams.args = [pdata.KEY_VALUE];
                            } else {
                                return 'Incorrect number of arguments. Expecting 1';
                            }

                        } else {
                            var query_id = "";
                            var argarr = [];
                            resparams.args = [];
                            pdata.FILTERS = pdata.FILTERS.sort(function (a, b) {
                                return a.GROUP_NO - b.GROUP_NO;
                            });
                            for (var idx = 0; idx < pdata.FILTERS.length; idx++) {
                                resparams.args.push(pdata.FILTERS[idx]["BINDING_VALUE"].toString());
                            }
                        }
                        console.info('- start getHistoryFor: %s\n', query_id);

                    } else if (pdata.HL_FUNCTION_TYPE == 'QuerywithPaging') {

                        var queryString = {};
                        queryString.selector = {};
                        if (pdata.FILTERS.length > 0) {
                            for (var idx = 0; idx < pdata.FILTERS.length; idx++) {
                                var obj = pdata.FILTERS[idx]["BINDING_NAME"].toLowerCase();
                                queryString.selector[obj] = pdata.FILTERS[idx]["BINDING_VALUE"];
                            }
                        } else {
                            if (pdata.SEARCHPARAMS) {
                                var SearchParams = JSON.parse(pdata.SEARCHPARAMS);
                                for (var sp = 0; sp < SearchParams.length; sp++) {
                                    if (SearchParams[sp].OPERATOR == "=" && SearchParams[sp]["VALUE"]) {
                                        var obj_key = SearchParams[sp]["BINDING_NAME"].toLowerCase();
                                        queryString.selector[obj_key] = SearchParams[sp]["VALUE"];
                                    }
                                }
                            }
                        }
                        var limit = pdata.RECORDS_PER_PAGE;
                        if (pdata.PAGENO == 1) {
                            queryString.skip = 0;
                        } else {
                            queryString.skip = pdata.PAGENO * limit;
                        }
                        queryString.limit = limit;
                        queryString.sort = [{ "_id": "asc" }];
                        queryString = JSON.stringify(queryString);
                        var pageSize = JSON.stringify(pdata.RECORDS_PER_PAGE);
                        var bookmark = "";
                        resparams.args = [queryString, pageSize, ""];
                    }
                    else if (pdata.HL_FUNCTION_TYPE == 'QuerywithId') {
                        var queryString = {};
                        queryString.selector = {};
                        if (pdata.FILTERS.length > 0) {
                            for (var idx = 0; idx < pdata.FILTERS.length; idx++) {
                                var obj = pdata.FILTERS[idx]["BINDING_NAME"].toLowerCase();
                                queryString.selector[obj] = pdata.FILTERS[idx]["BINDING_VALUE"];
                            }
                        } else {
                            if (pdata.SEARCHPARAMS) {
                                var SearchParams = JSON.parse(pdata.SEARCHPARAMS);
                                for (var sp = 0; sp < SearchParams.length; sp++) {
                                    if (SearchParams[sp].OPERATOR == "=") {
                                        var obj_key = SearchParams[sp]["BINDING_NAME"].toLowerCase();
                                        queryString.selector[obj_key] = SearchParams[sp]["VALUE"];
                                    }
                                }
                            }
                        }
                        queryString.sort = [{ "_id": "asc" }];
                        queryString = JSON.stringify(queryString);
                        var pageSize = JSON.stringify(pdata.RECORDS_PER_PAGE);
                        var bookmark = "";
                        resparams.args = [queryString];
                    }
                    resparams.fcn = pdata.HL_CHAINCODE_FUNCTION;
                    resparams.chaincodeName = pdata.HL_CHAINCODE;
                    return resparams;
                }
            });

        });
    }
    catch (error) {
        appResponse.send('Exception Occured ' + error);
    }

});
module.exports = router;