/*
@Api_Name : /Restorebackup,
@Description: To Restore from backup
@Last_Error_code:ERR-UI-110806
*/

// Require dependencies
var modPath = '../../../../node_modules/';
var referenceRoot = '../../../../torus-references/';
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogInfo = require(referenceRoot + 'log/trace/LogInfo');
var reqInsHelper = require(referenceRoot + '/common/InstanceHelper');
var reqSvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var strServiceName = 'Load ParamsConfig';
// API hosting

const SELTenant = 'Select * from tenants where client_id=?';
const CODEDESC = 'SELECT * FROM code_descriptions WHERE cd_code=?';

router.post('/LoadParamsConfig', function (appRequest, appResponse, next) {
    var result = {
        "Tenant_setup": [],
        "Scan_setting": [],
        "SCAN_LOADING": [],
        "Tenant_setup_source": []
    };

    var objLogInfo = '';
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (LogInfo, session_info) {
            // Handle the api close event from when client close the request
            // var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });
            _PrintInfo('Begin');
            // Initialize local variables
            // Initialize local variables
            objLogInfo = LogInfo;
            var pResp = appResponse;
            var strInputParamJson = appRequest.body.PARAMS;
            var NewColumnName = strInputParamJson.ColumnName;
            var NewColumnValue = strInputParamJson.ColumnValue;
            var strAppId = session_info.APP_ID;
            var strClient_id = session_info.CLIENT_ID;
            var strTntId = strInputParamJson.TENANT_ID;
            var mClient = '';
            var schemaSource = 'tenant_setup_source';
            objLogInfo.PROCESS = 'LoadParamsConfig-Ui';
            objLogInfo.ACTION_DESC = 'LoadParamsConfig';
            var category = strInputParamJson.CATEGORY
            var screen = strInputParamJson.PROCESS;
            var CondObj = {};
            var WhereCond = '';
            if (screen == 'tenant_setup') {
                CondObj = {
                    tenant_id: strTntId,
                    client_id: strClient_id
                };
                WhereCond = " where tenant_id = '" + strTntId + "' and client_id = '" + strClient_id + "'";
            } else if (screen == 'FX_SETUP_MASTER' || screen == 'TORUS_PLATFORM_SETUP') {
                schemaSource = 'fx_setup_master';
                if (category) {
                    WhereCond = " where setup_code = '" + category + "'"
                }
                if (NewColumnName && NewColumnValue) {
                    CondObj = {
                        [NewColumnName]: NewColumnValue
                    };
                }
            }

            // Function call
            _Prepareparams();
            //Prepareparams
            function _Prepareparams() {
                try {
                    reqFXDBInstance.GetFXDBConnection(appRequest.headers, 'clt_cas', objLogInfo, async function Callback_GetCassandraConn(pClient) {
                        mClient = pClient;
                        var query = ''
                        var DbType = pClient.DBConn.DBType;
                        if (category && DbType == 'pg' && screen == 'tenant_setup') {
                            var needDecrypt = reqSvchelper.checkNeedDecrypt(category);
                            var setupjsoncolumn = 'setup_json'
                            if (needDecrypt) {
                                // Set search path
                                await reqFXDBInstance.setSearchPath(pClient, ['clt_cas', 'tran_db'], objLogInfo);
                                setupjsoncolumn = `fn_pcidss_decrypt(setup_json, 'Pc!Nps$Key7') as setup_json`
                            }
                            query = "select client_id,tenant_id,category,created_by,created_date,description,editor_type,schema_json,version, $setup_json from " + screen + " where category ='" + category + "' and tenant_id= '" + strTntId + "' and client_id ='" + strClient_id + "'";
                            query = query.replace('$setup_json', setupjsoncolumn)
                        } else {
                            query = "select *  from " + screen;
                            if (WhereCond) {
                                query = query + WhereCond
                            }
                        }

                        reqFXDBInstance.ExecuteQuery(mClient, query, objLogInfo, function (pError, pResult) {
                            if (pError) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110801', 'Error In tenant_setup_version Table Execution', pError);
                            } else if (pResult) {
                                if (pResult.rows.length == 0 && screen == 'tenant_setup') {
                                    var ten_id = '0';
                                    reqFXDBInstance.GetTableFromFXDBNoCache(mClient, 'tenant_setup', [], {
                                        tenant_id: ten_id,
                                        client_id: strClient_id

                                    }, objLogInfo, function SELTCLIENT(pError, pResult) {
                                        if (pError) {
                                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110802', 'Error In tenant_setup_version Table Execution', pError);
                                        } else if (pResult) {
                                            prepareres(mClient, pResult, ten_id, strClient_id, function (res) {
                                                reqInsHelper.SendResponse(strServiceName, appResponse, res, objLogInfo, null, null, null);
                                            });

                                        }
                                    });
                                } else if (screen == 'tenant_setup') {
                                    prepareres(mClient, pResult, strTntId, strClient_id, function (res) {
                                        reqInsHelper.SendResponse(strServiceName, appResponse, res, objLogInfo, null, null, null);
                                    });
                                } else {
                                    _GetsetupSoruce(mClient, pResult, schemaSource, function (res) {
                                        reqInsHelper.SendResponse(strServiceName, appResponse, res, objLogInfo, null, null, null);
                                    });
                                }
                            }
                        });
                    });
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110803', 'Exception occured', error);
                }
            }



            // Print Log information
            function _PrintInfo(pMessage) {
                reqInsHelper.PrintInfo(strServiceName, pMessage, objLogInfo);
            }
            // Print Log Error
            function _PrintErr(pError, pErrorCode, pMessage) {
                reqInsHelper.PrintError(strServiceName, pError, pErrorCode, objLogInfo, pMessage);
            }

            function prepareres(mClient, pparams, pstrTntId, strClient_id, pcallback) {

                try {
                    result.Tenant_setup.push(pparams.rows);
                    reqFXDBInstance.GetTableFromFXDBNoCache(mClient, 'scan_settings', [], {
                        tenant_id: pstrTntId,
                        client_id: strClient_id

                    }, objLogInfo,
                        function SELScan(pError, scanResult) {
                            if (pError) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110805', 'Error In scan_settings Table Execution', pError);
                                errorHandler("ERR-FX-13323", pError);
                                // console.error(pError);
                            } else if (scanResult) {
                                if (scanResult.rows.length == 0) {
                                    var t_id = '0';
                                    reqFXDBInstance.GetTableFromFXDBNoCache(mClient, 'scan_settings', [], {
                                        tenant_id: t_id,
                                        client_id: strClient_id

                                    }, objLogInfo,
                                        function SELScan(pError, scanResult) {
                                            if (pError) {
                                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110806', 'Error In scan_settings Table Execution', pError);
                                            } else if (scanResult) {
                                                preparescan(mClient, scanResult, t_id, function (presult) {
                                                    pcallback(presult);
                                                });


                                            }
                                        });


                                } else {
                                    preparescan(mClient, scanResult, pstrTntId, function (presult) {
                                        pcallback(presult);
                                    });
                                }


                            }
                        });
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110807', 'Error In prepareres function', error);
                }
            }

            function _GetsetupSoruce(mClient, setupResult, processName, pacllbacl) {
                try {
                    var setupSourceQuery = "select *  from fx_setup_master";

                    if (category) {
                        WhereCond = " where setup_code = '" + category + "'";
                        setupSourceQuery = setupSourceQuery + WhereCond
                    }

                    // reqFXDBInstance.GetTableFromFXDBNoCache(mClient, processName, [], {}, objLogInfo, function ten_source_res(pError, pRes) {
                    reqFXDBInstance.ExecuteQuery(mClient, setupSourceQuery, objLogInfo, function (pError, pRes) {
                        if (pError) {
                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110811', 'Error In tenant_setup_source Table Execution', pError);
                        } else if (pRes) {
                            try {
                                result.setup = [];
                                result.setup_source = [];
                                if (setupResult.rows.length > 0) {
                                    result.setup.push(setupResult.rows);
                                }
                                result.setup_source.push(pRes.rows);
                                pacllbacl(result);
                            } catch (error) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110812', 'Exception Occured', error);
                            }
                        }
                    });

                } catch (error) {

                }
            }

            function preparescan(mClient, params, pt_id, prescallback) {
                try {
                    result.Scan_setting.push(params.rows);

                    reqFXDBInstance.GetTableFromFXDBNoCache(mClient, 'code_descriptions', [], {
                        cd_code: 'SCAN_SETTINGS',
                    }, objLogInfo,
                        function CODEDESC(pError, pRes) {
                            if (pError) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110808', 'Error In code_descriptions Table Execution', pError);
                            } else if (pRes) {
                                try {
                                    result.SCAN_LOADING.push(pRes.rows[0].code_value);
                                    getTenantSetupSource(mClient, function CallbackTen_Source() {
                                        prescallback(result);
                                    });
                                } catch (error) {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110809', 'Exception Occured', error);
                                }
                            }
                        });

                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-1108010', 'Error In preparescan function', error);
                }
            }

            function getTenantSetupSource(mClient, pTSSCallback) {
                try {
                    var fx_setup_masterqry = ''
                    if (category) {
                        fx_setup_masterqry = "select * from fx_setup_master where setup_code='" + category + "'"
                    } else {
                        fx_setup_masterqry = "select * from fx_setup_master"
                    }
                    reqFXDBInstance.ExecuteQuery(mClient, fx_setup_masterqry, objLogInfo, function (pError, pRes) {
                        // reqFXDBInstance.GetTableFromFXDBNoCache(mClient, 'fx_setup_master', [], {}, objLogInfo,function ten_source_res(pError, pRes) {
                        if (pError) {
                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110811', 'Error In tenant_setup_source Table Execution', pError);
                        } else if (pRes) {
                            try {
                                result.Tenant_setup_source.push(pRes.rows);
                                pTSSCallback();
                            } catch (error) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110812', 'Exception Occured', error);
                            }
                        }
                    });

                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-1108013', 'Error In getTenantSetupSource function', error);
                }
            }

        });
    } catch (error) {
        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110804', 'Error In  LoadParamsConfig ', error);
    }

});



module.exports = router;
// End function