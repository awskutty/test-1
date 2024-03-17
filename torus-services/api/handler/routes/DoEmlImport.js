/**
 *@Api_Name         :   /DoEmlImport,
 *@Description      :   To save the Eml Attachment 
 *@Last_Error_code  :   ERR-HAN-40819
 */

// Require dependencies
var reqExpress = require('express');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqemlhelper = require('../../../../torus-references/common/eml/EmlAttachmentHelper');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var async = require('async');
var serviceName = 'DoEmlImport';
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
//Queries
const tranquery = "Select * from TRANSACTION_SET where TS_ID=";

// Initialize Global variables
var strResult = '';
var strMessage = '';
var strServiceName = 'DoEmlImport';
var mResClient = '';
var router = reqExpress.Router();

// Host api to server
router.post('/DoEmlImport', function (appRequest, appResponse, pNext) {

    appRequest.body.PARAMS = appRequest.body;
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        try {
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });
            reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
            objLogInfo.HANDLER_CODE = 'IMPORT_FROM_EML';

            var mSession = null;
            var mdepClient = '';
            var strReqHeader = appRequest.headers;
            var ClientParams = appRequest.body;
            var Filedetail = appRequest.files;
            var Fileparams = [];
            var FileCount = '';
            //   var filebyte = ''
            var objLogInfo = objLogInfo;
            reqInstanceHelper.PrintInfo(serviceName, 'Calling DoEmlImport Method', objLogInfo);
            DoEmlImport(appRequest, ClientParams, objLogInfo, Fileparams, function (rescallback) {
                return reqInstanceHelper.SendResponse(strServiceName, appResponse, rescallback, objLogInfo, '', '', '');
            });
        } catch (error) {
            return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40801', 'Error in DoEmlImport Service', error);
        }


        // Method to Import EML 
        function DoEmlImport(pReq, ClientParams, objLogInfo, Fileparams, presultcall) {
            try {
                var intTS_ID = ClientParams.TS_ID;
                var intWFTPA_ID = ClientParams.WFTPA_ID;
                var UID = objSessionInfo.U_ID;
                var AppID = objSessionInfo.APP_ID;
                var STS_ID = objSessionInfo.APPSTS_ID;
                var System_id = objSessionInfo.SYSTEM_ID;
                FileCount = Object.keys(Filedetail).length;
                for (var i = 0; i < FileCount; i++) {
                    Fileparams.push(Filedetail["FILE_" + i]);
                }
                var ParamJSON = JSON.parse(ClientParams.FILE_DETAIL);
                var FileStartIndex = 10;
                var dt = [];
                reqInstanceHelper.PrintInfo(serviceName, 'Calling _InitializeDB method', objLogInfo);
                _InitializeDB(strReqHeader, function callbackInitializeDB(pStatus) {
                    //add two parmeter to implement the cassandra db as  resource server
                    var strResult = "";
                    try {
                        reqAuditLog.GetProcessToken(mSession, objLogInfo, function (err, prct_id) {
                            try {
                                if (err) {
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'Error Code', 'Error in GetProcessToken()', null, "Error", err.stack);
                                }
                                objLogInfo.PROCESS_INFO.PRCT_ID = prct_id;
                                reqInstanceHelper.PrintInfo(serviceName, 'Calling SaveEml method', objLogInfo);
                                SaveEml(pReq, ParamJSON, intTS_ID, intWFTPA_ID, UID, STS_ID, AppID, ClientParams, function (finalcallback) {
                                    presultcall(finalcallback);
                                });
                            } catch (error) {
                                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'Error Code', 'Catch Error in GetProcessToken()', null, "Error", err.stack);
                            }
                        });
                    } catch (error) {
                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40802', 'Error in SaveEml  function call', error);
                    }
                });
            } catch (error) {
                return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40803', 'Error in DoEmlImport function', error);
            }
        }


        // Method to SaveEml
        function SaveEml(pReq, pFileInfo, pTsId, pActionId, UID, STS_ID, AppId, Params, presultcallback) {
            var bconnected = false;
            var bCompleted = false;
            var ds = '';
            var pTargetTableName = "";
            var pTargetColumnName = "";
            var pAttachmentTableName = "";
            var NEED_ATMT_ENCRYPTION = "N";
            var ACCESSKEYINDEXVALUES = "";
            var DT_CODE = "";
            var DTT_CODE = "";
            var EML_COLUMNS = "";
            var HAS_PARENT = "";
            var EML_ATMT_DTT_CODE = "";
            var EML_ATMT_DT_CODE = "";
            var pTablename = "application_setup";
            var pTablenamesys = "system_to_system";
            var pTable = "systems";
            var pTablewf_info = "wf_info";
            var drWf_info = [];
            var result = "";
            var TRN_ID = "";
            var GRP_ID = "";
            var ATMTTARGETTABLENAME = "";
            var ATMTTARGETCOLUMNNAME = "";
            var update_TRN_ID = '';
            var htresult = {};
            var DTINFO = '';
            var count = 0;
            var emlcount = 0;
            try {
                reqInstanceHelper.PrintInfo(serviceName, 'Querying wf_info table', objLogInfo);
                reqFXDBInstance.GetTableFromFXDB(mdepClient, 'wf_info', [], {
                    app_id: AppId,
                    wftpa_id: pActionId
                }, objLogInfo, function selWfinfo(error, result) {
                    if (error) {
                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40804', 'Error in wf_info execution', error);
                    } else {
                        if (result.rows != undefined) {
                            var wfres = result.rows[0].param_json;
                            drWf_info = JSON.parse(wfres);

                            if (drWf_info.length > 0) {
                                drWf_info.forEach(function (obj) {
                                    if (obj.PARAM_NAME == 'EML_DTT_CODE') {
                                        DTT_CODE = obj.PARAM_VALUE;
                                    }
                                    if (obj.PARAM_NAME == 'EML_COLUMN_VALUES') {
                                        EML_COLUMNS = obj.PARAM_VALUE;
                                    }
                                    if (obj.PARAM_NAME == 'EML_ATMT_DTT_CODE') {
                                        EML_ATMT_DTT_CODE = obj.PARAM_VALUE;
                                    }
                                    if (obj.PARAM_NAME == 'HAS_PARENT') {
                                        HAS_PARENT = obj.PARAM_VALUE;
                                    }
                                });

                            }
                        }
                    }


                    var cond = tranquery + pTsId;
                    var DTTchildArray = [];
                    //  //Getting DT_info
                    reqTranDBInstance.ExecuteSQLQuery(mSession, cond, objLogInfo, function (pRes, error) {
                        if (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40805', 'Error in transaction set execution', error);
                        } else {
                            DT_CODE = pRes.rows[0].dt_code;
                            TRN_ID = pRes.rows[0].trn_id;
                            GRP_ID = pRes.rows[0].group_id;
                            //      try {

                            reqFXDBInstance.GetTableFromFXDB(mdepClient, 'dt_info', [], {
                                app_id: AppId,
                                dt_code: DT_CODE
                            }, objLogInfo, function SelDt_Info(error, result) {
                                if (error) {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40806', 'Error in dt_info execution', error);
                                } else if (result.rows.length != 0 && result.rows != undefined) {
                                    DTINFO = result.rows[0].relation_json;
                                    reqInstanceHelper.PrintInfo(serviceName, 'Executing async foreach', objLogInfo);
                                    async.forEach(JSON.parse(result.rows[0].relation_json), function (item, index, arr) {
                                        var targettabledetails = {
                                            "Tablename": "",
                                            "Columnname": ""
                                        };
                                        if (item.DTT_CODE == DTT_CODE) {
                                            pTargetTableName = item.TARGET_TABLE;
                                            pTargetColumnName = item.PRIMARY_COLUMN;
                                        }
                                        if (item.DTT_CODE == EML_ATMT_DTT_CODE) {
                                            ATMTTARGETTABLENAME = item.TARGET_TABLE;
                                            ATMTTARGETCOLUMNNAME = item.PRIMARY_COLUMN;
                                        }
                                        if (ATMTTARGETTABLENAME == "" && ATMTTARGETCOLUMNNAME == "") {
                                            ATMTTARGETTABLENAME = pTargetTableName;
                                            ATMTTARGETCOLUMNNAME = pTargetColumnName;
                                        }
                                        if (item.CHILD_DTT_RELEATIONS.length > 0) {
                                            DTTchildArray.push(item);
                                        }
                                    });
                                    async.forEach(DTTchildArray, function (item, index, arr) {
                                        var targettabledetails = {
                                            "Tablename": "",
                                            "Columnname": ""
                                        };
                                        if (pTargetTableName != '' && pTargetColumnName != '') {
                                            if (item.DTT_CODE == DTT_CODE) {
                                                pTargetTableName = item.TARGET_TABLE;
                                                pTargetColumnName = item.PRIMARY_COLUMN;
                                            } else if (item.DTT_CODE == EML_ATMT_DTT_CODE) {
                                                pAtmtTargetTbl = item.TARGET_TABLE;
                                                pAtmtTargetColumn = item.PRIMARY_COLUMN;
                                            }
                                        }
                                    });
                                    reqInstanceHelper.PrintInfo(serviceName, 'Executing async series', objLogInfo);
                                    async.series([
                                        function (callback) {
                                            async.forEachOf(pFileInfo, function (fileobj, key, rcallback) {
                                                count++;
                                                _PrepareTrnadata(DTT_CODE, DT_CODE, fileobj, EML_COLUMNS, HAS_PARENT, pTargetTableName, pTargetColumnName, ATMTTARGETTABLENAME, pTsId, TRN_ID, GRP_ID, UID, Params, update_TRN_ID, function (restrandata) {
                                                    update_TRN_ID = restrandata;
                                                    rcallback();
                                                });
                                            },
                                                function (err) {
                                                    if (err) {
                                                        reqInstanceHelper.PrintInfo(serviceName, err, objLogInfo);
                                                        callback();
                                                    } else {
                                                        callback();
                                                    }
                                                });
                                        },
                                        function (callback1) {
                                            async.forEachOf(pFileInfo, function (fileobj, key, rrcallback) {
                                                emlcount++;
                                                _EmlTranInsert(fileobj, DT_CODE, DTT_CODE, DTINFO, EML_ATMT_DTT_CODE, pActionId, htresult, ATMTTARGETTABLENAME, ATMTTARGETCOLUMNNAME, UID, Params, count, ACCESSKEYINDEXVALUES, GRP_ID, TRN_ID, update_TRN_ID, function (emlres) {
                                                    if (emlres) { }
                                                    rrcallback();
                                                });
                                            },
                                                function (err) {
                                                    if (err) {
                                                        reqInstanceHelper.PrintInfo(serviceName, err, objLogInfo);
                                                        callback1();
                                                    } else {
                                                        callback1();
                                                    }
                                                });

                                        }
                                    ],
                                        // optional callback
                                        function (err) {
                                            if (err) {
                                                reqInstanceHelper.PrintInfo(serviceName, err, objLogInfo);
                                                presultcallback('FAILURE');
                                            } else {
                                                presultcallback('SUCCESS');
                                            }

                                        });

                                } else {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40807', '', '', "FAILURE", 'No rows dt_info execution', "", "");
                                }
                            });
                        }
                    });
                });
            } catch (error) {
                return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40808', 'Error in SaveEml function', error);
            }
        }


        var SaveEmlAttachment = [];
        var resqw = {};
        var filebyte = "";
        var Filename = '';
        var filesize = '';
        var param = {};

        // Insert EML data
        function _EmlTranInsert(fileobj, DT_CODE, DTT_CODE, DTINFO, EML_ATMT_DTT_CODE, pActionId, htresult, ATMTTARGETTABLENAME, ATMTTARGETCOLUMNNAME, UID, Params, count, ACCESSKEYINDEXVALUES, GRP_ID, TRN_ID, update_TRN_ID, prescallback) {
            try {
                async.series([
                    function (callbackasync) {
                        async.forEachOf(Fileparams, function (value, key, callback) {
                            content = '';
                            if (fileobj.FILENAME == Fileparams[key].name) {
                                filebyte = Fileparams[key].data;
                                filebyte = new Buffer.from(filebyte).toString('base64');
                                // fs.appendFile('D:\\datas1.txt', filebyte + "\n\n\n");
                                Filename = Fileparams[key].name;
                                filesize = Fileparams[key].size;
                                param.Filename = Filename;
                                param.ACCESSKEYINDEXVALUES = ACCESSKEYINDEXVALUES;
                                param.AttachmentData = JSON.stringify(filebyte);
                                param.USER_ID = UID;
                                param.File_size = filesize;
                                param.APP_ID = objSessionInfo.APP_ID;
                                param.APP_DESC = objLogInfo.APP_DESC;
                                param.USER_NAME = objSessionInfo.USER_NAME;
                                param.SYSTEM_ID = objSessionInfo.SYSTEM_ID;
                                param.SYSTEM_DESC = objSessionInfo.SYSTEM_DESC;
                                param.SESSION_ID = objSessionInfo.SESSION_ID;
                                param.HANDLER_CODE = "SaveEmlAttachment";
                                param.MENU_ITEM_DESC = objLogInfo.MENU_ITEM_DESC;
                                param.ACTION_DESC = objLogInfo.ACTION_DESC;
                                param.CLIENT_ID = objSessionInfo.USER_ID;
                                param.PARENT_PROCESS = "DoEmlImport";
                                param.PRCT_ID = objLogInfo.PROCESS_INFO.PRCT_ID;
                                param.DT_CODE = DT_CODE;
                                param.DTT_CODE = DTT_CODE;
                                var strresult = "";
                                filebyte = '';
                                reqemlhelper.PrepareEmlAttachment(appRequest, param, function (presult) {
                                    if (presult) {
                                        filebyte = '';
                                        SaveEmlAttachment = presult;
                                        callback();
                                    } else {
                                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40819', presult.ERROR_MESSAGE, presult.ERR_OBJ);
                                    }


                                });
                            }
                        }, function (err) {
                            if (err) {
                                reqInstanceHelper.PrintInfo(serviceName, err, objLogInfo);
                                callbackasync();
                            } else {
                                callbackasync();
                            }

                        });
                    },
                    function (callbackasync1) {
                        var i = 0;
                        async.forEachOf(SaveEmlAttachment, function (value, key, callback1) {
                            i++;
                            resqw = {};
                            if (value.AT_CODE.indexOf(".") !== -1) {
                                value.AT_CODE = value.AT_CODE.substring(1);
                            }
                            resqw.ORIGINAL_FILE_NAME = value.ORIGINAL_FILE_NAME;
                            resqw.RELATIVE_PATH = value.RELATIVE_PATH;
                            resqw.AT_CODE = value.AT_CODE;
                            resqw.FILE_SIZE = value.FILE_SIZE;
                            resqw.GROUP_ID = GRP_ID;
                            resqw.TOTAL_PAGES = 0;
                            resqw.TRN_ID = '';
                            emlattachmentupdate(DT_CODE, DTT_CODE, DTINFO, EML_ATMT_DTT_CODE, pActionId, resqw, ATMTTARGETTABLENAME, ATMTTARGETCOLUMNNAME, UID, Params, update_TRN_ID, function (pres) {
                                if (SaveEmlAttachment.length === i) {
                                    callbackasync1();
                                } else {
                                    callback1();
                                }
                            });
                            //  resarray.push(resqw);
                        }, function (err) {
                            if (err) {
                                reqInstanceHelper.PrintInfo(serviceName, err, objLogInfo);
                                callbackasync1();
                            } else {
                                callbackasync1();
                            }
                        });
                    },

                ],
                    function (err) {
                        if (err) {
                            reqInstanceHelper.PrintInfo(serviceName, err, objLogInfo);
                            prescallback('FAILURE');
                        } else {
                            prescallback('SUCCESS');
                        }

                    });

            } catch (ex) {
                return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40809', 'Error in DoEmlImport function', error);
            }
        }

        // Update Eml Attachment
        function emlattachmentupdate(pDT_CODE, pDTT_CODE, pDTINFO, pEML_ATMT_DTT_CODE, pActionId, pobj, pATMTTARGETTABLENAME, pATMTTARGETCOLUMNNAME, pUID, pParams, update_TRN_ID, presfinalcall) {
            try {
                UpdateEml(pDT_CODE, pDTT_CODE, pDTINFO, pEML_ATMT_DTT_CODE, pActionId, pobj, pATMTTARGETTABLENAME, pATMTTARGETCOLUMNNAME, pUID, pParams, update_TRN_ID, function (result) {
                    // pTargetTableName = Nothing
                    pTargetColumnName = '';
                    pAttachmentTableName = '';
                    NEED_ATMT_ENCRYPTION = '';
                    ACCESSKEYINDEXVALUES = '';
                    DT_CODE = '';
                    DTT_CODE = '';
                    EML_COLUMNS = '';
                    bCompleted = true;
                    presfinalcall('SUCCESS');
                });
            } catch (error) {
                return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40819', 'Error in DoEmlImport function', error);
            }
        }

        // Method to initialize DB
        function _InitializeDB(pHeaders, pCallback) {
            try {
                reqFXDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pClient) {
                    mdepClient = pClient;
                    reqFXDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pClientClt) {
                        mClient = pClientClt;
                        reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                            mSession = pSession;
                            pCallback('Success');
                        });
                    });
                });
            } catch (error) {
                return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40810', 'Error in _InitializeDB function', error);
            }
        }

        //Prepare data for Transaction 
        function _PrepareTrnadata(pDTT_CODE, pDT_CODE, pfile, pEML_COLUMNS, pHAS_PARENT, pTargetTableName, pTargetColumnName, pAttachmentTableName, pTS_ID, pParentTran_ID, pGRP_ID, pUID, pParams, update_TRN_ID, callback) {
            try {
                var LOGIN_NAME = "";
                var APPID = "";
                var EMAIL_ID = "";
                var MOBILE_NO = "";
                var SYSTEM_DESC = "";
                var SYSID = "";
                var strDTDesc = '';
                var strDTTDesc = '';
                if (objSessionInfo.LOGIN_NAME) {
                    LOGIN_NAME = objSessionInfo.LOGIN_NAME;
                }
                if (objSessionInfo.SYSTEM_DESC) {
                    SYSTEM_DESC = objSessionInfo.SYSTEM_DESC;
                }
                if (objSessionInfo.APP_ID) {
                    APPID = objSessionInfo.APP_ID;
                }
                if (objSessionInfo.SYSTEM_ID) {
                    SYSID = objSessionInfo.SYSTEM_ID;
                }

                var htresult = {};
                var targettable = pTargetTableName;
                var httrntable = {};
                var splitedarray = pEML_COLUMNS.split("|");
                splitedarray.forEach(function (Column) {
                    var ColumnName = Column.split("~")[0];
                    var ColumnValue = Column.split("~")[1];
                    if (ColumnValue == "EML_FILE_NAME") {
                        httrntable[ColumnName] = pfile.FILENAME;
                    } else {
                        httrntable[ColumnName] = ColumnValue;
                    }
                });
                if (pHAS_PARENT == "Y") {
                    httrntable['PARENT_' + pTargetColumnName] = pParentTran_ID;
                }
                reqFXDBInstance.GetTableFromFXDB(mdepClient, 'dt_info', [], {
                    app_id: APPID,
                    dt_code: pDT_CODE
                }, objLogInfo, function (pErr, pResultCas) {
                    if (pErr) {
                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40811', 'Error in TRANSACTION_SET execution', error);
                    } else {
                        if (pResultCas.rows != undefined && pResultCas.rows != 0) {
                            strDTDesc = pResultCas.rows[0].dt_description;
                        } else {
                            strDTDesc = '';
                        }
                        reqFXDBInstance.GetTableFromFXDB(mdepClient, 'dtt_info', [], {
                            app_id: APPID,
                            dtt_code: pDTT_CODE
                        }, objLogInfo, function (pErr, Dttres) {
                            if (pErr) {
                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40814', 'Error in dtt_info execution', pErr);
                            } else {
                                if (Dttres.rows != 0) {
                                    strDTTDesc = Dttres.rows[0].dtt_description;
                                } else {
                                    strDTTDesc = '';
                                }
                                httrntable.SYSTEM_ID = SYSID;
                                httrntable.SYSTEM_NAME = SYSTEM_DESC;
                                httrntable.DT_CODE = pDT_CODE;
                                httrntable.DTT_CODE = pDTT_CODE;
                                httrntable.DT_DESCRIPTION = strDTDesc;
                                httrntable.DTT_DESCRIPTION = strDTTDesc;
                                httrntable.PRCT_ID = objLogInfo.PROCESS_INFO.PRCT_ID;
                                httrntable.VERSION_NO = "0";
                                httrntable.STATUS = "CREATED";
                                httrntable.PROCESS_STATUS = "CREATED";
                                var tranarray1 = [];
                                tranarray1.push(httrntable);
                                reqTranDBInstance.InsertTranDBWithAudit(mSession, targettable, tranarray1, objLogInfo, function callbackExecuteSQL(pRes) {
                                    if (pRes) {
                                        update_TRN_ID = pRes[0][pTargetColumnName.toLowerCase()];
                                        var httrntrnsettable = {};
                                        //  //TRANSACTION_SET insert
                                        httrntrnsettable.DT_CODE = pDT_CODE;
                                        httrntrnsettable.DTT_CODE = pDTT_CODE;
                                        httrntrnsettable.DT_DESCRIPTION = strDTDesc;
                                        httrntrnsettable.DTT_DESCRIPTION = strDTTDesc;
                                        httrntrnsettable.SYSTEM_ID = SYSID;
                                        httrntrnsettable.SYSTEM_NAME = SYSTEM_DESC;
                                        httrntrnsettable.VERSION_NO = "0";
                                        httrntrnsettable.TRN_ID = update_TRN_ID;
                                        httrntrnsettable.GROUP_ID = pGRP_ID;
                                        httrntrnsettable.PARENT_TS_ID = pTS_ID;
                                        httrntrnsettable.PRCT_ID = objLogInfo.PROCESS_INFO.PRCT_ID;
                                        httrntrnsettable.STATUS = "CREATED";
                                        httrntrnsettable.PROCESS_STATUS = "CREATED ";

                                        var tranarray2 = [];
                                        tranarray2.push(httrntrnsettable);
                                        reqTranDBInstance.InsertTranDBWithAudit(mSession, "TRANSACTION_SET", tranarray2, objLogInfo, function callbackExecuteSQL(pRes) {
                                            if (pRes) {
                                                //TRN_ATTACHMENTS
                                                var htresult = {};
                                                htresult = _FillAttachment(pTargetColumnName, pfile.FILE_NAME, pDT_CODE, pDTT_CODE, pTargetColumnName, pUID);
                                                // Audit columns
                                                htresult.SYSTEM_ID = SYSID;
                                                htresult.CREATED_BY_NAME = LOGIN_NAME;
                                                htresult.SYSTEM_NAME = SYSTEM_DESC;
                                                callback(update_TRN_ID);
                                            } else {
                                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40812', 'Error in TRANSACTION_SET execution', error);
                                            }
                                        });
                                    } else {
                                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40813', 'Error in' + targettable + 'execution', error);
                                    }
                                });
                            }
                        });
                    }
                });
            } catch (error) {
                return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40815', 'Error in _PrepareTrnadata function', error);
            }
        }

        //Prepare data for Attachment
        function _FillAttachment(pTargetcolumnName, pSourceFilename, DTCode, DTTCode, TRN_ID, UID) {
            try {
                var httrnAttachmenttable = {};
                httrnAttachmenttable.DT_CODE = DTCode;
                httrnAttachmenttable.DTT_CODE = DTTCode;
                httrnAttachmenttable.TRN_ID = TRN_ID;
                httrnAttachmenttable.DTTA_ID = "0";
                httrnAttachmenttable.DTTAD_ID = "0";
                httrnAttachmenttable.DTTAC_DESC = "General";
                httrnAttachmenttable.SOURCE = "MANUAL";
                httrnAttachmenttable.SOURCE_DETAILS = "FROM_EML";
                httrnAttachmenttable.IS_CURRENT = "Y";
                httrnAttachmenttable.SORT_ORDER = "0";
                httrnAttachmenttable.CREATED_DATE = reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo);
                httrnAttachmenttable.VERSION_NO = "0";
                return httrnAttachmenttable;
            } catch (error) {
                return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40816', 'Error in _FillAttachment function', error);
            }
        }

        //Update Eml data in Tran Db
        function UpdateEml(DT_CODE, pDTT_code, pDTINFO, pEML_ATMT_DTT_CODE, pActionId, httran, pATMTTARGETTABLENAME, pATMTTARGETCOLUMNNAME, pUID, pParams, update_TRN_ID, presponsecallback) {
            try {
                var LOGIN_NAME = "";
                var SYSTEM_DESC = "";
                var appid = "0";
                var SYSTEM_ID = "0";
                var pAttachmentTableName = "";
                var strDT_Desc = '';
                var strDTTDesc = '';
                var httrntable = {};
                var tgtcolumn = [pATMTTARGETCOLUMNNAME][0];
                if (objSessionInfo.LOGIN_NAME)
                    LOGIN_NAME = objSessionInfo.LOGIN_NAME;
                if (pParams.SYSTEM_DESC)
                    SYSTEM_DESC = objSessionInfo.SYSTEM_DESC;
                if (objSessionInfo.APP_ID)
                    appid = objSessionInfo.APP_ID;
                if (objSessionInfo.SYSTEM_ID)
                    SYSTEM_ID = objSessionInfo.SYSTEM_ID;

                //Target Table insert
                reqFXDBInstance.GetTableFromFXDB(mdepClient, 'dt_info', [], {
                    app_id: appid,
                    dt_code: DT_CODE
                }, objLogInfo, function (pErr, pResultCas) {

                    if (pErr) {
                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40818', 'Error in dt_info execution', pErr);
                    } else {
                        if (pResultCas.rows != 0) {
                            strDTDesc = pResultCas.rows[0].dt_description;
                        } else {
                            strDTDesc = '';
                        }
                        reqFXDBInstance.GetTableFromFXDB(mdepClient, 'dtt_info', [], {
                            app_id: appid,
                            dtt_code: pEML_ATMT_DTT_CODE
                        }, objLogInfo, function (pErr, Dttres) {
                            if (Dttres) {
                                strDTTDesc = Dttres.rows[0].dtt_description;
                            }

                            if (strDTDesc != '' && strDTTDesc != '') {
                                var insertarray1 = [];
                                httrntable.CREATED_BY = pUID;
                                httrntable.CREATED_BY_NAME = LOGIN_NAME;
                                httrntable.SYSTEM_ID = SYSTEM_ID;
                                httrntable.SYSTEM_NAME = SYSTEM_DESC;
                                httrntable.CREATED_DATE = reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo);
                                httrntable.STATUS = "CREATED ";
                                httrntable.PROCESS_STATUS = "CREATED";
                                httrntable.DT_CODE = DT_CODE;
                                httrntable.DT_DESCRIPTION = strDT_Desc;
                                httrntable.DTT_CODE = pEML_ATMT_DTT_CODE;
                                httrntable.DTT_DESCRIPTION = strDTTDesc;
                                httrntable.PRCT_ID = objLogInfo.PROCESS_INFO.PRCT_ID;
                                httrntable.VERSION_NO = "0";
                                httrntable.MODIFIED_BY = pUID;
                                httrntable.MODIFIED_DATE = reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo);
                                insertarray1.push(httrntable);
                                var cond = {

                                };
                                cond[pATMTTARGETCOLUMNNAME] = update_TRN_ID;

                                var insertarray3 = [];
                                var ht = httran;
                                ht.TRN_ID = update_TRN_ID;
                                if (!ht.DT_CODE)
                                    ht.DT_CODE = DT_CODE;
                                if (!ht.SORT_ORDER)
                                    ht.SORT_ORDER = "0";
                                if (!ht.IS_CURRENT)
                                    ht.IS_CURRENT = "Y";
                                if (!ht.SOURCE)
                                    ht.SOURCE = "MANUAL";
                                if (!ht.DTTAC_DESC)
                                    ht.DTTAC_DESC = "General";
                                if (!ht.DTTAD_ID)
                                    ht.DTTAD_ID = "0";
                                if (!ht.DTTA_ID)
                                    ht.DTTA_ID = "0";
                                if (!ht.CREATED_BY)
                                    ht.CREATED_BY = pUID;
                                if (!ht.CREATED_DATE)
                                    ht.CREATED_DATE = reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo);
                                if (!ht.VERSION_NO) {
                                    ht.VERSION_NO = "0";
                                    ht.DTT_CODE = pDTT_code;
                                    ht.SOURCE_DETAILS = "FROM_EML";
                                }
                                if (!ht.ATMT_DTT_CODE) {
                                    ht.ATMT_DTT_CODE = pEML_ATMT_DTT_CODE;
                                } else {
                                    ht.ATMT_DTT_CODE = pEML_ATMT_DTT_CODE;
                                }
                                if (!ht.ATMT_TS_ID) {
                                    ht.ATMT_TS_ID = null;
                                }
                                if (!ht.ATMT_TRN_ID) {
                                    ht.ATMT_TRN_ID = null;
                                }
                                if (!ht.CREATED_BY_NAME)
                                    ht.CREATED_BY_NAME = LOGIN_NAME;
                                if (!ht.SYSTEM_NAME)
                                    ht.SYSTEM_NAME = SYSTEM_DESC;
                                if (!ht.SYSTEM_ID)
                                    ht.SYSTEM_ID = SYSTEM_ID;
                                if (!ht.MODIFIED_BY)
                                    ht.MODIFIED_BY = pUID;
                                if (!ht.MODIFIED_DATE)
                                    ht.MODIFIED_DATE = reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo);
                                ht['APP_ID'] = objLogInfo.APP_ID;
                                ht['TENANT_ID '] = objLogInfo.TENANT_ID;
                                insertarray3.push(ht);
                                reqTranDBInstance.InsertTranDBWithAudit(mSession, "TRN_ATTACHMENTS", insertarray3, objLogInfo, function (pResult) {
                                    if (pResult) {
                                        presponsecallback('SUCCESS');
                                    } else {
                                        presponsecallback('FAILURE');
                                    }
                                });
                            } else {
                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40817', 'Error in DoEmlImport function', error);
                            }
                        });
                    }

                });
            } catch (error) {
                return reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40818', 'Error in DoEmlImport function', error);
            }
        }
    });
});

module.exports = router;
/*********** End of Service **********/