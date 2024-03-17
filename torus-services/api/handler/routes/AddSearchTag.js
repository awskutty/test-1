/*
@Api_Name         : /AddSearchTag,
@Description      : Add tags for particular transactions or attachments for future searching (Global Indexing),
@Last_Error_code  : ERR-HAN-40816
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var solrInstance = require('../../../../torus-references/instance/SolrInstance');
var serviceHelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

var serviceName = 'AddSearchTag';

// Global variable initialization
var mResCas = '';
var mTranDB = '';
var pCoreName = 'dynamic_core';
var reqSolrInstance = '';
var pHeaders = '';

// Host the api to server
router.post('/AddSearchTag', function (appRequest, appResponse, next) {
  var objLogInfo;
  reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
    appResponse.on('close', function () { });
    appResponse.on('finish', function () { });
    appResponse.on('end', function () { });

    try {
      reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
      pHeaders = appRequest.headers;
      appResponse.setHeader('Content-Type', 'application/json');
      objLogInfo.HANDLER_CODE = 'ADD_SEARCH_TAG';
      var APP_ID = objSessionInfo.APP_ID;
      var FN_NAME = appRequest.body.PARAMS.FN_NAME;
      var TAB_DATA = appRequest.body.PARAMS.SEL_DATA;
      var DT_CODE = TAB_DATA.dt_code;
      var DTT_CODE = TAB_DATA.dtt_code;
      var NODE_TYPE = TAB_DATA.node_type;
      reqInstanceHelper.PrintInfo(serviceName, 'Getting FXDB Connection', objLogInfo);
      reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
        mResCas = pClient;
        reqInstanceHelper.PrintInfo(serviceName, 'Getting TranDB Connection', objLogInfo);
        reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
          mTranDB = pSession;
          reqInstanceHelper.PrintInfo(serviceName, 'FN Name is ' + FN_NAME, objLogInfo);
          if (FN_NAME == 'LOAD_TRANSRCH_TREE') {
            reqInstanceHelper.PrintInfo(serviceName, 'Calling LoadTranSearchLst', objLogInfo);
            LoadTranSearchLst(objLogInfo, DT_CODE, DTT_CODE, TAB_DATA, NODE_TYPE, APP_ID, function (response) {
              if (response.STATUS === 'SUCCESS') {
                reqInstanceHelper.SendResponse(serviceName, appResponse, response.SUCCESS_DATA, objLogInfo, null, null, null);
                return;
              } else {
                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, response.ERROR_CODE, response.ERROR_MESSAGE, response.ERROR_OBJECT);
                return;
              }
            });
          } else if (FN_NAME == 'ADD_TRANSRCH_TREE') {
            var finalobj = {};
            reqInstanceHelper.PrintInfo(serviceName, 'Calling AddTranSearchTag', objLogInfo);
            AddTranSearchTag(objLogInfo, DT_CODE, DTT_CODE, TAB_DATA, NODE_TYPE, APP_ID, appRequest.body.PARAMS, function (callbackAddResponse) {
              if (callbackAddResponse.STATUS === 'SUCCESS') {
                LoadTranSearchLst(objLogInfo, DT_CODE, DTT_CODE, TAB_DATA, NODE_TYPE, APP_ID, function (response) {
                  if (response.STATUS === 'SUCCESS') {
                    reqInstanceHelper.SendResponse(serviceName, appResponse, response.SUCCESS_DATA, objLogInfo, null, null, null);
                    return;
                  } else {
                    reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, response.ERROR_CODE, response.ERROR_MESSAGE, response.ERROR_OBJECT);
                    return;
                  }
                });
                return;
              } else {
                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, callbackAddResponse.ERROR_CODE, callbackAddResponse.ERROR_MESSAGE, callbackAddResponse.ERROR_OBJECT);
                return;
              }
            });
          } else if (FN_NAME == 'DEL_TRANSRCH_TREE') {
            var finalobj = {};
            reqInstanceHelper.PrintInfo(serviceName, 'Calling DeleteSelTran', objLogInfo);
            DeleteSelTran(objLogInfo, DT_CODE, DTT_CODE, TAB_DATA, NODE_TYPE, APP_ID, appRequest.body.PARAMS, function (callbackdeltran) {
              if (callbackdeltran.STATUS === 'SUCCESS') {
                LoadTranSearchLst(objLogInfo, DT_CODE, DTT_CODE, TAB_DATA, NODE_TYPE, APP_ID, function (response) {
                  if (response.STATUS === 'SUCCESS') {
                    reqInstanceHelper.SendResponse(serviceName, appResponse, response.SUCCESS_DATA, objLogInfo, null, null, null);
                    return;
                  } else {
                    reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, response.ERROR_CODE, response.ERROR_MESSAGE, response.ERROR_OBJECT);
                    return;
                  }
                });
                return;
              } else {
                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, callbackdeltran.ERROR_CODE, callbackdeltran.ERROR_MESSAGE, callbackdeltran.ERROR_OBJECT);
                return;
              }
            });
          } else {
            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, '', 'FN_NAME not given', null);
            return;
          }
        });
      });
    } catch (error) {
      reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-HAN-40801', 'Exception occured initially', error);
      return;
    }

    function CheckForSolrIndexing(pFromLoadFn, pSolrResult, pCallbackCheckSolr) {
      if (pFromLoadFn) {
        reqInstanceHelper.PrintInfo(serviceName, 'Getting dtt_info in LoadTranSearchLst', objLogInfo);
        reqDBInstance.GetTableFromFXDB(mResCas, 'dtt_info', '*', {
          app_id: APP_ID,
          dtt_code: DTT_CODE
        }, objLogInfo, function (pErr, pResultDTT) {
          if (pResultDTT.rows[0].need_solr_index === 'Y') {
            pCallbackCheckSolr(true);
          }
        });
      } else {
        pCallbackCheckSolr(pSolrResult);
      }
    }

    // List the tags against the selected transcation from transaction_search_tags table (Not from solr)
    function LoadTranSearchLst(objLogInfo, DT_CODE, DTT_CODE, param, NODE_TYPE, APP_ID, callbackLoad) {
      try {
        reqDBInstance.GetTableFromFXDB(mResCas, 'dt_info', '*', {
          dt_code: DT_CODE
        }, objLogInfo, function (pErr, pResult) {
          if (pErr) {
            callbackLoad(sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40802', 'Exception occurs while getting dtinfo', pErr));
          } else {
            var response = pResult.rows[0]['relation_json'];

            var pKeycol = serviceHelper.GetTargetTableAndKeyColumn(JSON.parse(response), DTT_CODE, objLogInfo).Data;
            var dataarray = (pKeycol !== undefined) ? pKeycol.split(',') : [];
            var keyval = '';

            if (NODE_TYPE === 'TRAN') {
              if (param.hasOwnProperty(dataarray[1])) {
                keyval = param[dataarray[1]];
              } else {
                keyval = param['trn_id'];
              }
            } else {
              keyval = param['trna_id'];
            }
            // Get it form DB
            reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
              var strCond = {};
              strCond['ITEM_TYPE'] = NODE_TYPE;
              strCond['ITEM_ID'] = keyval;
              strCond['DTT_CODE'] = DTT_CODE;
              reqTranDBInstance.GetTableFromTranDB(pSession, 'transaction_search_tags', strCond, objLogInfo, function CallbackGetTable(pResult, pError) {
                _AssignDataToControlFromTableData(pResult, DTT_CODE, NODE_TYPE, pKeycol, function (resp) {
                  callbackLoad(resp);
                });
              });
            });
          }
        });
      } catch (error) {
        callbackLoad(sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40805', 'Exception occurs while executing LoadTranSearchLst method', error));
      }
    }

    /**
     * get tags data from solr DYNAMIC_CORE against trn/trna
     * @param  {} callback
     */
    _getdataFromSolr = function (APP_ID, NODE_TYPE, keyval, callback) {
      try {
        var data = '';

        if (NODE_TYPE = 'TRAN') {
          data = 'TRNA_ID:' + keyval;
        } else {
          data = 'TRN_ID:' + keyval;
        }

        solrInstance.SolrSearch(pHeaders, 'DYNAMIC_CORE', data, function (callbackSolrSelectResponse) {
          if (callbackSolrSelectResponse) {
            callback(sendMethodResponse('SUCCESS', '', callbackSolrSelectResponse.response, '', '', ''));
          } else {
            callback(sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40807', 'No Data Found', ''));
          }
        });
      } catch (error) {
        callback(sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40806', 'Exception occurs while executing _getdataFromSolr method', error));
      }
    };

    // Form object from solr search result
    function _AssignDataToControlFromTableData(pRows, DTT_CODE, NODE_TYPE, pKeycol, callbackAssignDataToControl) {
      var resObj = {};
      try {
        var finalObj = {};
        var arrResult = [];
        for (var i in pRows) {
          var objResult = {};
          objResult.TST_TEXT = pRows[i]['tst_text'];
          objResult.TST_ID = pRows[i]['tst_id'];
          objResult.TARGET_COLUMN = 'MANUAL';
          objResult.DTT_CODE = DTT_CODE;
          objResult.FX_KEY_COLUMN = pKeycol;
          objResult.NODE_TYPE = NODE_TYPE;
          arrResult.push(objResult);
        }

        var notVisibleColumns = '';
        notVisibleColumns = 'TRNA_ID,_VERSION_,TST_ID';
        RowCount = pRows.length;

        finalObj['RowContent'] = arrResult;
        finalObj['NotVisibleColumnContent'] = notVisibleColumns;
        finalObj['RowCount'] = RowCount;

        resObj = sendMethodResponse('SUCCESS', '', finalObj, '', '', '');
        callbackAssignDataToControl(resObj);
      } catch (error) {
        resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40808', 'Exception occurs in AssignDataToControlFromSolrDocs method', error);
        callbackAssignDataToControl(resObj);
      }
    }

    /**
     * Form datasource according to list binding
     * @param  {} pdtfiles
     * @param  {} pColumndet
     * @param  {} callback
     */
    _AssignDataToControl = function (pdtfiles, pColumndet, callback) {
      try {
        var lstColumnDetail = [];

        var columns = pColumndet.Split(',');
        for (var i in columns) {
          var coldet = {};
          coldet.Name = columns.split('~')[0];
          coldet.Header = columns.Split('~')[1];
          coldet.Width = 'Auto';
          lstColumnDetail.push(coldet);
        }

        var strNotVisibleColumns = '';

        var strMainRow = '';

        for (var i in pdtfiles) {
          var strFormRow = '';

          for (var j in pdtfiles[i]) {
            if (!pdtfiles[i][j]['Key'] !== '') { }
          }
        }

        callback(pdtfiles);
      } catch (error) { }
    };

    /**
     * Add a new tag for trn/trna
     * @param  {} params
     * @param  {} callback
     */
    function AddTranSearchTag(objLogInfo, DT_CODE, DTT_CODE, param, NODE_TYPE, APP_ID, body, callbackend) {
      var resObj = {};
      try {
        reqDBInstance.GetTableFromFXDB(mResCas, 'dt_info', '*', {
          dt_code: DT_CODE
        }, objLogInfo, function (pErr, pResult) {
          if (!pErr) {
            var response = pResult.rows[0]['relation_json'];

            // returns a string with TARGET_TABLE , PRIMARY_COLUMN , DTT_DESCRIPTION
            var pKeycol = serviceHelper.GetTargetTableAndKeyColumn(JSON.parse(response), DTT_CODE, objLogInfo).Data;
            var dataarray = (pKeycol !== undefined) ? pKeycol.split(',') : [];
            var keyval = '';

            if (NODE_TYPE === 'TRAN') {
              if (param.hasOwnProperty(dataarray[1])) {
                keyval = param[dataarray[1]];
              } else {
                keyval = param['trn_id'];
              }
            } else {
              keyval = param['trna_id'];
            }

            var dataAdd = [];
            var data = {};

            if (NODE_TYPE = 'TRAN') {
              data['TRNA_ID'] = keyval;
            } else {
              data['TRN_ID'] = keyval;
            }

            data['DTTCode'] = DTT_CODE;
            data['_GLOBAL_SEARCH_'] = body.SRCH_TXT;

            // if (body.TST_ID !== '' && body.TST_ID !== 0 && body.TST_ID.length !== 0) {
            //   data['id'] = body.TST_ID
            // }

            if (body.SEL_DATA['node_type'] === 'ATMT') {
              data.isATMT = true;
            } else {
              data.isATMT = false;
            }

            var objtemp = {};
            objtemp['response'] = data;
            dataAdd.push(data);
            reqDBInstance.GetTableFromFXDB(mResCas, 'dtt_info', '*', {
              app_id: APP_ID,
              dtt_code: DTT_CODE
            }, objLogInfo, function (pErr, pResultDTT) {
              if (pErr) {
                callbackend(sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40810', 'Error executing dtt_info', pErr));
              } else {
                reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                  var objInsert = [{
                    'tst_text': data['_GLOBAL_SEARCH_'],
                    'item_type': body.SEL_DATA['node_type'],
                    'item_id': keyval,
                    'dtt_code': DTT_CODE,
                    'app_id': objLogInfo.APP_ID,
                    'tenant_id': objLogInfo.TENANT_ID
                  }];
                  reqTranDBInstance.InsertTranDBWithAudit(pSession, 'transaction_search_tags', objInsert, objLogInfo, function callbacktranSearchTagInsert(pResult, pError) {
                    if (pError) {
                      callbackend(sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40810', 'Error insert transaction_search tags to tran db', pError));
                      return;
                    }
                    if (pResultDTT.rows[0].need_solr_index === 'Y') {
                      dataAdd[0]['TST_ID'] = pResult[0]['tst_id'];
                      solrInstance.SolrAdd(pHeaders, 'DYNAMIC_CORE', dataAdd, objLogInfo, function (resp) {
                        if (resp) {
                          resObj = sendMethodResponse('SUCCESS', '', '', '', '', '');
                          callbackend(resObj);
                        } else {
                          resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40809', 'Error while adding data to solr', '');
                          callbackend(resObj);
                        }
                      });
                    }
                  });
                });
              }
            });
          } else {
            resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40811', 'Error while fetching data from dt_info', pErr);
            callbackend(resObj);
          }
        });
      } catch (error) {
        resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40812', 'Exception occured while executing AddTranSearchTag method', error);
        callbackend(resObj);
      }
    }

    // Delete the tag 
    function DeleteSelTran(objLogInfo, DT_CODE, DTT_CODE, TAB_DATA, NODE_TYPE, APP_ID, params, callbackdel) {
      var resObj = {};
      try {
        var ITEM_TYPE = params.ITEM_TYPE;
        var TST_ID = params.TST_ID;
        var DTT_CODE = params.DTT_CODE;
        var APP_ID = APP_ID;

        reqDBInstance.GetTableFromFXDB(mResCas, 'dtt_info', '*', {
          app_id: APP_ID,
          dtt_code: DTT_CODE
        }, objLogInfo, function (pErr, pDttResult) {
          var keyval = '';

          var query = [];
          query.push(TST_ID);
          reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
            reqTranDBInstance.DeleteTranDB(pSession, 'transaction_search_tags', {
              TST_ID: TST_ID
            }, objLogInfo, function callbackDeleteTagInsert(pResult, pError) {
              if (pError) {
                callbackdel(sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40810', 'Error delete transaction_search tags to tran db', pError));
                return;
              }
              if (pDttResult.rows[0].need_solr_index === 'Y') {
                solrInstance.SolrDelete(pHeaders, 'DYNAMIC_CORE', 'TST_ID', query, objLogInfo, function (callbackSolrDeleteResponse) {
                  if (callbackSolrDeleteResponse) {
                    resObj = sendMethodResponse('SUCCESS', '', callbackSolrDeleteResponse, '', '', '');
                    callbackdel(resObj);
                  } else {
                    resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40813', 'Solr delete failed', error);
                    callbackdel(resObj);
                  }
                });
              }
            });
          });
        });
      } catch (error) {
        resObj = sendMethodResponse('FAILURE', '', '', 'ERR-HAN-40815', 'Exception occurs in DeleteSelTran method', error);
        callbackdel(resObj);
      }
    }
  });


});

// Send response to main function
function sendMethodResponse(status, successMessage, SuccessDataObj, errorCode, errorMessage, errorObject) {
  var obj = {
    'STATUS': status,
    'SUCCESS_MESSAGE': successMessage,
    'SUCCESS_DATA': SuccessDataObj,
    'ERROR_CODE': errorCode,
    'ERROR_MESSAGE': errorMessage,
    'ERROR_OBJECT': errorObject
  };
  return obj;
}

module.exports = router;
  /*********** End of Service **********/