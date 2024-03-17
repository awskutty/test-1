/**
 * Api_Name         : /TransactionDataSearch
 * Description      : To search the transaction data from trandb
 * Last Error_Code  : ERR-AUT-15205
 New service
 */

// Require dependencies
var modPath = '../../../../node_modules/';
var refPath = '../../../../torus-references/';
var reqExpress = require(modPath + 'express');
var JLinq = require('node-linq').LINQ;
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqSolrInstance = require('../../../../torus-references/instance/SolrInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDateFormat = require(modPath + 'dateformat');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqCommon = require('../../../../torus-references/transaction/Common');

// Initialize Global variables


var router = reqExpress.Router();

var serviceName = 'GetTransactionAttachement';

// Host the auditlog api
router.post('/GetExchangeDetails', function (appRequest, appResponse) {
    var pHeaders = appRequest.headers;

    reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, pSessionInfo) {

        var objResult = {};
        var params = appRequest.body.PARAMS;
        var strRecordsPerPage = '100';
        var strCurrentPageNo = appRequest.body.PARAMS.CURRENT_PAGENO || 1;
        var objLogInfo = {};
        var arrDateColumns = [];
        objLogInfo = pLogInfo;
        objLogInfo.HANDLER_CODE = 'GetExchangeDetails';
        var srcCriteria = '';

        TranCommentPagination = '';
        var ExhId = params.ExhId;
        var ExhFId = params.ExhFId;
		var FileName=params.FILE_NAME;
        var filterTable = '';
        GetExchangeData();

        function GetExchangeData() {
            try {
                if (ExhId) {
                    srcCriteria = "{!join from=EXH_ID to=EXH_ID from=EXHF_ID to=EXHF_ID}EXH_ID:" + ExhId;
                } else if (ExhFId) {
                    srcCriteria = "EXHF_ID:" + ExhFId;
                    filterTable = 'ex_header_files';
                }else if(FileName){
					 srcCriteria = "FILE_NAME:" + FileName;
				}
                //'(EXH_ID:' + ExhId + ')';
                reqSolrInstance.LogSolrSearchWithPaging(pHeaders, 'FX_TRAN', srcCriteria, strRecordsPerPage, strCurrentPageNo, function callbackLogSolrSearchWithPaging(result, error) {
                    if (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298002', 'Error on querying solr', error);
                    } else {
                        var FullDoc = result.response.docs;
                        var resObj = {};

                        var ExheaderFiles = new JLinq(FullDoc).Where(function (doc) {
                            return doc.FX_TABLE_NAME[0] === "ex_header_files";
                        }).ToArray();
                        resObj.ExHeaderFiles = ExheaderFiles;
                        var fileTrans = new JLinq(FullDoc).Where(function (doc) {
                            return doc.FX_TABLE_NAME[0] === "ex_file_trans";
                        }).ToArray();
                        resObj.FileTrans = fileTrans;

                        return reqInstanceHelper.SendResponse(serviceName, appResponse, resObj, objLogInfo, '', '', '', 'SUCCESS', '');
                    }
                });
            } catch (error) {
                return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298001', 'Error on querying solr', error);
            }

        }
    });
});

module.exports = router;