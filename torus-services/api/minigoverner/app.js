/*
    @Service name       : MiniGoverner,
    @Description        : This is a main file for all api calls in this service,
    @Number of API's    : 23
*/

// Require dependencies
var reqInstanceHelper = require('../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../torus-references/instance/DBInstance');
var servicePath = 'MiniGoverner';

// Include the cluster module
var reqCluster = require('cluster');
// Code to run if we're in the master process
if (!reqCluster.isMaster) {
    // Count the machine's CPUs
    var cpuCount = require('os').cpus().length;
    // Create a worker for each CPU
    for (var i = 0; i < cpuCount; i += 1) {
        reqCluster.fork();
    }
    // Listen for dying workers
    reqCluster.on('exit', function (worker) {
        // Replace the dead worker, we're not sentimental
        console.log('Worker %d died :(', worker.id);
        reqCluster.fork();
    });
    // Code to run if we're in a worker process
} else {
    var reqEvents = require('events');
    var reqAppHelper = require('../../../torus-references/instance/AppHelper');

    var objEvents = new reqEvents();
    objEvents.on('EventAfterInit', AfterInitDBListener);
    process.title = 'Torus_Svc_MiniGoverner';
    // reqAppHelper.LoadAllInstanses(servicePath, function (pResult) {
    //     if (pResult == 'SUCCESS') {
    //         reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
    //         objEvents.emit('EventAfterInit');
    //     }
    // });

    reqInstanceHelper.GetConfig('SERVICE_MODEL', function (ResSvcModel) {
        reqDBInstance.LoadServiceModel('SERVICE_MODEL', JSON.parse(ResSvcModel), function (res) {
            reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
            objEvents.emit('EventAfterInit');
        });
    })

    function AfterInitDBListener() {
        var arrRoutes = [];
        var reqPing = require('./routes/Ping');
        var reqLdapUserListing = require('./routes/LdapUserListing');
        var reqLdapUserDelete = require('./routes/LdapUserDelete');
        var reqCreateUser = require('./routes/CreateUser');
        var reqGetSearchRoles = require('./routes/GetSearchRoles');
        var reqGetDesignerlst = require('./routes/GetDesignerlst');
        var reqDeleteUserProcess = require('./routes/DeleteUserProcess');
        var reqDeleteSystemProcess = require('./routes/DeleteSystemProcess');
        var reqSaveAppUserSTS = require('./routes/SaveAppUserSTS');
        var reqSearchUser = require('./routes/SearchUser');
        var reqSTSSearch = require('./routes/STSSearch');
        var reqLoadClusters = require('./routes/LoadClusters');
        var reqLoadAppsts = require('./routes/LoadAppsts');
        var reqUserLockUnlock = require('./routes/UserLockUnlock');
        var reqGetSystemParams = require('./routes/GetSystemParams');
        var reqGetParentSystem = require('./routes/GetParentSystem');
        var reqSaveSystem = require('./routes/SaveSystem');
        var reqGetRolesWorkflow = require('./routes/GetRolesWorkflow');
        var reqInviteUser = require('./routes/InviteUser');
        var reqSaveAssignedAppSTS = require('./routes/SaveAssignedAppSTS');
        var reqAppSTSSearch = require('./routes/AppSTSSearch');
        var reqGetClientAppUsers = require('./routes/GetClientAppUsers');
        var reqSaveCluster = require('./routes/SaveCluster');
        var reqDeleteCluster = require('./routes/DeleteCluster');
        var reqLoadSystemTypes = require('./routes/LoadSystemTypes');
        var reqSaveSystemType = require('./routes/SaveSystemType');
        var reqDeleteSystemType = require('./routes/DeleteSystemType');
        var reqLoadClusterSystem = require('./routes/LoadClusterSystem');
        var reqSaveClusterSystem = require('./routes/SaveClusterSystem')
        var reqDeleteClusterSystem = require('./routes/DeleteClusterSystem');
        var reqCheckClusterSystem = require('./routes/CheckClusterSystem');
        var reqEnforcepwd = require('./routes/Enforcepwd');
        var reqGetClusterSystems = require('./routes/GetClusterSystems');
        var reqUnassignCluster = require('./routes/UnassignCluster');
        var reqAssignAppSts = require('./routes/AssignAppSts');
        var reqUnAssignappsts = require('./routes/UnassignAppSts');
        var reqUnAssignUser = require('./routes/UnAssignUser');
        var reqReleaseTranLock = require('./routes/ReleaseTranLock');
        var reqEnableDisable = require('./routes/EnableDisableSystem');
        var reqClusterDetails = require('./routes/GetClusterDetails');
        var reqMinigovernerSetup = require('./routes/LoadMinigovernerSetup');
        var reqSavestaticmodules = require('./routes/SaveStaticModule');
        var reqGetstaticmodules = require('./routes/GetStaticModule');
        var reqchecksuperadmin = require('./routes/CheckSuperAdmin');
        var reqgetusergroup = require('./routes/GetUserGroup');
        var reqsaveusergrp = require('./routes/SaveUserGroup');
        var reqdeleteusergrp = require('./routes/DeleteUserGroup');
        var reqAppUserRoleDtls = require('./routes/GetAppUserRoleDetails');
        var reqLoadApplications = require('./routes/LoadApplications');
        var reqSystemCluster = require('./routes/GetSystemCluster');
        var reqShowUserData = require('./routes/ShowUserData')

        arrRoutes.push(reqLoadApplications);
        arrRoutes.push(reqAppUserRoleDtls);
        arrRoutes.push(reqPing);
        arrRoutes.push(reqLdapUserListing);
        arrRoutes.push(reqLdapUserDelete);
        arrRoutes.push(reqCreateUser);
        arrRoutes.push(reqGetSearchRoles);
        arrRoutes.push(reqGetDesignerlst);
        arrRoutes.push(reqDeleteUserProcess);
        arrRoutes.push(reqDeleteSystemProcess);
        arrRoutes.push(reqSaveAppUserSTS);
        arrRoutes.push(reqSearchUser);
        arrRoutes.push(reqSTSSearch);
        arrRoutes.push(reqLoadClusters);
        arrRoutes.push(reqLoadAppsts);
        arrRoutes.push(reqUserLockUnlock);
        arrRoutes.push(reqGetSystemParams);
        arrRoutes.push(reqGetParentSystem);
        arrRoutes.push(reqSaveSystem);
        arrRoutes.push(reqGetRolesWorkflow);
        arrRoutes.push(reqInviteUser);
        arrRoutes.push(reqSaveAssignedAppSTS);
        arrRoutes.push(reqAppSTSSearch);
        arrRoutes.push(reqGetClientAppUsers);
        arrRoutes.push(reqSaveCluster);
        arrRoutes.push(reqDeleteCluster);
        arrRoutes.push(reqLoadSystemTypes);
        arrRoutes.push(reqSaveSystemType);
        arrRoutes.push(reqDeleteSystemType);
        arrRoutes.push(reqLoadClusterSystem);
        arrRoutes.push(reqSaveClusterSystem);
        arrRoutes.push(reqDeleteClusterSystem);
        arrRoutes.push(reqCheckClusterSystem);
        arrRoutes.push(reqEnforcepwd);
        arrRoutes.push(reqGetClusterSystems);
        arrRoutes.push(reqUnassignCluster);
        arrRoutes.push(reqAssignAppSts);
        arrRoutes.push(reqUnAssignappsts);
        arrRoutes.push(reqUnAssignUser);
        arrRoutes.push(reqReleaseTranLock);
        arrRoutes.push(reqEnableDisable);
        arrRoutes.push(reqClusterDetails);
        arrRoutes.push(reqMinigovernerSetup);
        arrRoutes.push(reqSavestaticmodules);
        arrRoutes.push(reqGetstaticmodules);
        arrRoutes.push(reqchecksuperadmin);
        arrRoutes.push(reqgetusergroup)
        arrRoutes.push(reqsaveusergrp)
        arrRoutes.push(reqdeleteusergrp)
        arrRoutes.push(reqSystemCluster);
        arrRoutes.push(reqShowUserData)
        reqAppHelper.StartService(servicePath, arrRoutes, __dirname);
    }
}
/******** End of File *******/