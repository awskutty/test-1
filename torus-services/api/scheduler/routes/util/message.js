function defineMessage(name, value) {
    Object.defineProperty(exports, name, {
        value: value,
        enumerable: true
    });
}


defineMessage("SUCCESS", "Success");
defineMessage("FAILURE", "Failure");

defineMessage("COUNTER_CREATION_FAILURE", "Failed to create counter value");

defineMessage("SCHEDULER_TEMPLATE_CREATION_SUCCESS", "Scheduler Template has been added successfully");
defineMessage("SCHEDULER_TEMPLATE_DELETION_SUCCESS", "Scheduler Template has been deleted successfully");
defineMessage("SCHEDULER_JOB_CREATION_SUCCESS", "Scheduler Job has been created successfully");
defineMessage("SCHEDULER_JOB_DELETION_SUCCESS", "Scheduler Job has been deleted successfully");
defineMessage("SCHEDULER_TEMPLATE_UPDATION_SUCCESS", "Scheduler Template has been updated successfully");
defineMessage("SCHEDULER_JOB_THREAD_LOG_ADD_SUCCESS", "Scheduler Job threead log added successfully");
defineMessage("SCHEDULER_JOB_LOG_DELETION_SUCCESS", "Schduler Job log has been deleted successfully");
defineMessage("SCHEDULER_JOB_LOG_ADD_SUCCESS", "Scheduler Job Log has been added successfully");
defineMessage("SCHEDULER_JOB_LOG_UPDATE_SUCCESS", "Scheduler Job Log has been updated successfully");

defineMessage("SCHEDULER_SCHEDULE_TEMPLATE_DELETION_SUCCESS","Schedule Template has been deleted successfully");

defineMessage("SCHEDULE_TEMPLATE_CREATION_SUCCESS","Schedule Template has been created successfully");

defineMessage("JOBSTARTED", "Started");
defineMessage("JOBSTOPPED", "Stopped");
defineMessage("JOBABORTED", "Aborted");

defineMessage("THREADSTARTED", "Started");
defineMessage("THREADSTOPPED", "Stopped");
defineMessage("THREADABORTED", "Aborted");
defineMessage("THREADCOMPLETED", "Completed");

defineMessage("JOBEXIST","JOBS EXIST FOR THIS TEMPLATE PLEASE DELETE IT FIRST");