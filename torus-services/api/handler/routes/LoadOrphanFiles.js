var reqExpress = require('express');
var router = reqExpress.Router();
//var reqDBInstance = require('../../../../torus-references/helper/CassandraInstance');
//var reqCassandraInstance = require('../../../../torus-references/helper/CassandraInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var StringBuilder = require("string-builder");
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');



var mTranDB = '';
router.post('/LoadOrphanFiles', function (req, res, next) {
  console.log('loadorphanfiles start');
  //     reqDBInstance.GetFXDBConnection(req.headers, 'dep_cas', objLogInfo, function Callback_GetCassandraConn(mClient) {
  //reqCassandraInstance.GetCassandraConn(req.headers, 'dep_cas', function Callback_GetCassandraConn(mClient) {
  console.log('loadorphanfiles start.');
  var strOrm = 'knex';
  var DTT_Code = 'DTT_1304_1475833341484';
  var pDTCODE = 'DT_1304_1475833243317';
  var pTTARGET_TABLE = '';
  var pkeycolumn = '';
  var APP_ID = '12';  // req.body.APP_ID;
  var claim_no = req.body.claimno;
  var providerid = req.body.providerid;
  var memberid = req.body.memberid;
  var year = req.body.year;
  var month = req.body.month;
  var page = req.body.pageno;
  var type = req.body.type;
  var Recordperpage = req.body.Recordperpage;
  var liststatus = req.body.liststatus;

  if (page == undefined) {
    page = "1";
  }

  var strtargetcolumn = '';
  var strtargetvalue = '';
  var pTTARGET_TABLE = '';

  var ccondition = '';
  var showpage = true;
  console.log('loadorphanfiles started.');
  console.log(type);
  // To find trn_id value
  var objLogInfo = reqLogInfo.AssignLogInfoDetail(req.body, req);
  reqTranDBInstance.GetTranDBConn(req.headers, false, function (pSession) {
    console.log(liststatus);
    mTranDB = pSession;
    if (type == 'STATUSWISELIST') {
      var findtrn_idquery = "select count(*) countvalue,tncd.provider_id,provider_name,ncp_year,ncp_month,to_CHAR(created_date, 'YYYY-MM-DD') created_date from trn_nlic_claim_details TNCD	inner join providers pr on pr.provider_id = tncd.provider_id where status='" + liststatus + "' group by tncd.provider_id,ncp_year,ncp_month,provider_name,to_CHAR(created_date, 'YYYY-MM-DD') order by created_date desc ";
      console.log(findtrn_idquery);
    }
    else {
      if (type != 'trnorphan') {
        var findtrn_idquery = "select trna_id,tncd_id,provider_id,relative_path,ncp_claim_no,ncp_year,ncp_month from trn_nlic_claim_details t inner join trn_attachments trna on trna.trn_id = t.tncd_id WHERE checked_out_by_name='ORPHAN' and provider_id='" + providerid + "'";
      }
      else {
        var findtrn_idquery = "select tncd_id,provider_id,ncp_claim_no,ncp_year,ncp_month from trn_nlic_claim_details  WHERE status='ORPHAN' and provider_id='" + providerid + "'";
      }
    }
    console.log('page');
    console.log(page);
    console.log('recordperpage');
    console.log(Recordperpage);
    reqTranDBInstance.ExecuteQueryWithPagingCount(mTranDB, findtrn_idquery, page, Recordperpage, objLogInfo, function (ptrnResult, pcount, pErr) {
      if (ptrnResult.length == 0) {
        console.log('key_column not found", "ERR-FX-133402');
        var arr = [];
        res.send(arr);
      }
      else {
        var trnidvalues = '';
        var relativepathvalues = new StringBuilder();
        var arr = [];

        // Get Relativepath details
        for (var k = 0; k < ptrnResult.length; k++) {
          var sfc = {};
          if (type == 'STATUSWISELIST') {
            sfc.countvalue = ptrnResult[k]['countvalue'];
            sfc.provider_id = ptrnResult[k]['provider_id'];;
            sfc.provider_name = ptrnResult[k]['provider_name'];
            sfc.ncp_year = ptrnResult[k]['ncp_year'];
            sfc.ncp_month = ptrnResult[k]['ncp_month'];
            sfc.totalpages = pcount;
            sfc.recordperpage = Recordperpage;
            arr.push(sfc);
          }
          else {
            if (type != 'trnorphan') {
              sfc.KEYDATA = ptrnResult[k]['relative_path'];
              sfc.Claims = ptrnResult[k]['ncp_claim_no'];;
              sfc.AT_CODE = 'IMG';
              //sfc.TNCD_ID=ptrnResult[k]['tncd_id'];
              sfc.trna_id = ptrnResult[k]['trna_id'];
              sfc.YEAR = year;
              sfc.MONTH = month;
              //sfc.TRNA_ID=
              sfc.selectedFile = { "Name": ptrnResult[k]['ncp_claim_no'] };
              sfc.selectedClient = { "Name": providerid };
              sfc.documentYear = year;
              sfc.documentMonth = month;
              sfc.showpages = 'false';
              sfc.loadorphandata = "true";
              sfc.PageNo = k + 1;
              sfc.pageName = " Orphan -";
              sfc.totalpages = pcount;
              sfc.orphantype = 'ATTACHLEVELORPHAN';
              sfc.recordperpagelist = Recordperpage;
              arr.push(sfc);
            }
            else {
              sfc.KEYDATA = ptrnResult[k]['relative_path'];
              sfc.Claims = ptrnResult[k]['ncp_claim_no'];
              sfc.AT_CODE = 'IMG';
              sfc.trna_id = ptrnResult[k]['tncd_id'];
              sfc.YEAR = year;
              sfc.MONTH = month;
              sfc.selectedFile = { "Name": ptrnResult[k]['ncp_claim_no'] };
              sfc.selectedClient = { "Name": providerid };
              sfc.documentYear = year;
              sfc.documentMonth = month;
              sfc.showpages = 'false';
              sfc.loadorphandata = "true";
              sfc.PageNo = k + 1;
              sfc.pageName = " Orphan -";
              sfc.totalpages = pcount;
              sfc.orphantype = 'TRANLEVELORPHAN';
              sfc.orphandatafound = 'true';
              sfc.recordperpagelist = Recordperpage;
              arr.push(sfc);
            }
          }
        }
      }
      res.send(arr);
    });
  });

  //  });

  function errorHandler(errcode, message) {
    console.log(message, errcode);
    reqLogWriter.TraceError(objLogInfo, message, errcode);
  }

});

module.exports = router;