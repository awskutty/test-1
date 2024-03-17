// Require dependencies

var reqInstanceHelper = require('../common/InstanceHelper');
var reqFXDBInstance = require('../instance/DBInstance');
var reqServiceHelper = require('../common/serviceHelper/ServiceHelper');
var async = require('async');
var serviceName = 'GetQryInfo';
function getqryinfo(reqdata, pcallback) {
    try {
        var objLogInfo = reqdata.objLogInfo;
        var pHeaders = reqdata.headers;
        var CurstCode = reqdata.params.ST_CODE;
        var pdepClient = reqdata.pdepClient;
        var CurPsid = reqdata.params.PARENT_S_ID;
        var ClusterCode = reqdata.params.CLUSTER_CODE;
        var param = reqdata.params;
        var reqobj = {};
        reqobj.TARGET_TABLE = 'QRY_INFO';
        reqobj.COLUMN = ['SYSTEM_TYPE,UICGC_CODE', 'FINAL_STATE'];
        reqobj.DEFAULT_CASE = false;
        reqobj.CONDITION = {
            WFTPA_ID: param.WFTPA_ID,
            DT_CODE: param.DT_CODE,
            DTT_CODE: param.DTT_CODE,
            EVENT_CODE: param.EVENT_CODE,
            SYSTEM_TYPE: CurstCode
        };
        _printInfo('getqryinfo function called ', objLogInfo);
        //  Getting data from QRY_INFO table with loggedin system type case
        Gettablefromdata(reqobj).then(function (result) {
            SuccessRes(result, false);
        }).catch(function (error) {

        });

        function SuccessRes(result, UseClntstatus) {
            _printInfo('Success Data ', objLogInfo);
            var resobj = {};
            resobj.RESULT = 'SUCCESS';
            resobj.USE_CLIENT_STATUS = UseClntstatus;
            if (result && result[0].final_state) {
                var tsStatus = JSON.parse(result[0].final_state).TS;
                tsStatus.forEach(element => {
                    resobj[element.BINDING_NAME] = element.BINDING_VALUE;
                });
            } else {
                resobj.USE_CLIENT_STATUS = true;
                _printInfo('Final status not found. Use client side status as final status', objLogInfo);
            }
            _printInfo('Success Callback going to called.', objLogInfo);
            pcallback(resobj);
        }


        function failureRes(error) {
            var resobj = {};
            resobj.USE_CLIENT_STATUS = false;
            resobj.RESULT = 'FAILURE';
            resobj.ERROR = error;
            pcallback(resobj);

        }
        function Gettablefromdata(preqobj) {
            return new Promise((resolve, reject) => {
                _printInfo(preqobj.TARGET_TABLE + ' query executing ', objLogInfo);
                reqFXDBInstance.GetTableFromFXDB(pdepClient, preqobj.TARGET_TABLE, preqobj.COLUMN, preqobj.CONDITION, objLogInfo, function (err, result) {
                    if (err) {
                        failureRes(err);
                    } else {
                        if (result.rows.length) {
                            _printInfo('Got the result from query info', objLogInfo);
                            resolve(result.rows);
                        }
                        else if (preqobj.DEFAULT_CASE) {
                            _printInfo('Got the result from query for default system type', objLogInfo);
                            SuccessRes('', true);
                        } else {
                            /* if logged in system type and default system type does not had an entry from QRY_INFO
                             then get the hierarchical parent list and again try to get the data from QRY_INFO table */

                            _printInfo('Rows not found from query info need to get the parent stcode and query QRY_INFO table ', objLogInfo);
                            var appReqobj = {};
                            appReqobj.TARGET_TABLE = 'APP_SYSTEM_TO_SYSTEM';
                            appReqobj.CONDITION = {
                                app_id: objLogInfo.APP_ID,
                                cluster_code: ClusterCode
                            };
                            appReqobj.COLUMN = [];
                            getappsts(appReqobj, preqobj).then(function (hparent) {
                                LoopandMatchstCode(hparent, reqobj);
                            }).catch(function (error) {
                                failureRes(error);
                            });
                        }
                    }
                });
            });
        }


        function getappsts(appreqobj, preqobj) {
            return new Promise((resolve, reject) => {
                _printInfo('Getting app sts data function executing ', objLogInfo);
                reqFXDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pcltClient) {
                    reqFXDBInstance.GetTableFromFXDB(pcltClient, appreqobj.TARGET_TABLE, appreqobj.COLUMN, appreqobj.CONDITION, objLogInfo, function (err, result) {
                        if (err) {
                            reject(err);
                        } else {
                            if (result.rows.length) {
                                var pReqObj = {};
                                pReqObj.resultRows = result.rows;
                                pReqObj.curParentSID = CurPsid;
                                pReqObj.resultSId = [];
                                _printInfo('Getting hierarchical parent lists', objLogInfo);
                                // @ hparent - hierarchical parent list

                                var hparent = reqServiceHelper.GetHierarchyParent(pReqObj);

                                _printInfo(' hierarchical parent Count' + hparent.length, objLogInfo);
                                resolve(hparent);
                            } else {
                                _printInfo('No Rows found while query app sts table', objLogInfo);
                                reject('No Rows found while query app sts table');
                            }
                        }
                    });
                });
            });
        }

        function LoopandMatchstCode(pHparent, preqobj) {
            async.forEachOfSeries(pHparent, function (prow, idx, callback) {
                preqobj.CONDITION.SYSTEM_TYPE = prow.st_code;
                _printInfo('Query the table using st code | ' + prow.st_code, objLogInfo);
                reqFXDBInstance.GetTableFromFXDB(pdepClient, preqobj.TARGET_TABLE, preqobj.COLUMN, preqobj.CONDITION, objLogInfo, function (err, result) {
                    if (err) {
                        return failureRes(err);
                    } else if (result.rows.length) {
                        _printInfo('Record found Loop ended.', objLogInfo);
                        SuccessRes(result.rows, false);
                    } else {
                        _printInfo('No Record found Loop Continue...', objLogInfo);
                        callback();
                    }
                });
            }, function (error) {
                if (!error) {

                    /* No final status found
                      Getting data from QRY_INFO table with default system type case                
                    */
                    _printInfo('No Record found. Getting data from QRY_INFO table with default system type case', objLogInfo);
                    getdefaultsystemtypevalue(preqobj);
                }
            });
        }

        //  Getting data from QRY_INFO table with default system type case
        function getdefaultsystemtypevalue(preqobj) {
            preqobj.DEFAULT_CASE = true;
            preqobj.CONDITION.SYSTEM_TYPE = 'DEFAULT';
            Gettablefromdata(preqobj).then(function (result) {
                _printInfo('Default System case data found ', objLogInfo);
                SuccessRes(result, false);
            }).catch(function (error) {
                failureRes(error);
            });
        }

        function _printInfo(msg, objLogInfo) {
            reqInstanceHelper.PrintInfo(serviceName, msg, objLogInfo);
        }

    } catch (error) {
        failureRes(error);
    }
}

module.exports = {
    GetQryInfo: getqryinfo
};