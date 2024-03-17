/*  Created BY      :Udhaya
    Created Date    :28-jun-2016
    Purpose         :Get  Roles from apaas_roles table
    */
// Require dependencies
var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
// Initialize DB
// var mClient = reqCasInstance.SessionValues['plt_cas'];

//Prepare Query
const APAASUSRROLE = 'select role_code,role_description from apaas_roles';
//Host api
router.post('/GetAPUserRole', function (req, resp) {

    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.query, req);
    objLogInfo.PROCESS = 'GetAPUserRole-Authentication';
    objLogInfo.ACTION = 'GetAPUserRole';
    reqLogWriter.Eventinsert(objLogInfo)
    var mClient = '';
    try {

        //Function call
        GetAPUserRole();

        //Prepare Function
        function GetAPUserRole() {
            try {
                DBInstance.GetFXDBConnection(req.headers, 'plt_cas', objLogInfo, function Callback_GetCassandraConn(res) {
                    mClient = res;
                    reqLogWriter.TraceInfo(objLogInfo, 'GetAPUserRole called...');
                    var objApaasRoles = {};
                    var arrApaasUser = []; //role_code,role_description from apaas_roles';
                    DBInstance.GetTableFromFXDB(mClient, 'apaas_roles', [role_code, role_description], [], objLogInfo, function callbackGetAPUserRole(err, pResult) {
                        try {
                            if (err)
                                reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10126");
                            else {
                                //Prepare JSON
                                for (i = 0; i < pResult.rows.length; i++) {
                                    objappasrole = {};
                                    objappasrole.ROLE_CODE = pResult.rows[i].role_code;
                                    objappasrole.ROLE_DESCRIPTION = pResult.rows[i].role_description;
                                    arrApaasUser.push(objappasrole);
                                }
                                objApaasRoles.APAAS_ROLES = arrApaasUser;
                                reqLogWriter.TraceInfo(objLogInfo, 'GetAPUserRole Loaded successfully... ');
                                reqLogWriter.EventUpdate(objLogInfo);
                                resp.send(objApaasRoles);
                            }
                        } catch (error) {
                            errorHandler("ERR-FX-10126", "Error GetAPUserRole function" + error)
                        }
                    });
                });
            } catch (error) {
                errorHandler("ERR-FX-10125", "Error GetAPUserRole function" + error)
            }
        }

    } catch (error) {
        errorHandler("ERR-FX-10124", "Error GetAPUserRole function" + error)
    }

    function errorHandler(errcode, message) {
        console.log(message, errcode);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }
})


module.exports = router;
//*******End of Serive*******//