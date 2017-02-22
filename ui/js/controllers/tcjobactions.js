"use strict";

treeherder.controller('TCJobActionsCtrl', function($scope, $http, $uibModalInstance,
                                                   ThResultSetStore, ThJobDetailModel,
                                                   thTaskcluster, ThTaskclusterErrors,
                                                   thNotify,
                                                   job, repoName, resultsetId) {
    $scope.input = {};

    $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
w    };

    $scope.updateSelectedAction = function(selectedAction) {
        $scope.input.jsonPayload = JSON.stringify(jsonSchemaDefaults($scope.input.selectedAction.schema), null, 4);
    };

    $scope.triggerAction = function() {
        $scope.triggering = true;

        let task = _.clone($scope.input.selectedAction.task);
        // update the various date properties with evaluations
        task = thTaskcluster.refreshTimestamps(task)
        //['created', 'deadline', 'expires'].map(function(dateProp) {
        // task[dateProp] = thTaskcluster.fromNow(task[dateProp]['$fromNow']);
        //});
        task.payload.env['ACTION_INPUT'] = $scope.input.jsonPayload;
        task.payload.env['ACTION_PARAMETERS'] = null; // fixme: unclear what to set this to
        task.payload.env['ACTION_TASK'] = null; // fixme: what is this supposed to do?
        task.payload.env['ACTION_TASK_ID'] = JSON.stringify(job.taskId);

        $http.get('https://queue.taskcluster.net/v1/task/' + job.taskId).then(function(response) {
            task.payload.env['ACTION_TASK_GROUP_ID'] = JSON.stringify(response.data.taskGroupId);
            let tc = thTaskcluster.client();
            let queue = new tc.Queue();
            let taskId = tc.slugid();
            queue.createTask(taskId, task).then(function() {
                $scope.$apply(thNotify.send("Custom action request sent successfully", 'success'));
                $scope.triggering = false;
                $uibModalInstance.close('request sent');
            }, function(e) {
                $scope.$apply(thNotify.send(ThTaskclusterErrors.format(e), 'danger', true));
                $scope.triggering = false;
                $uibModalInstance.close('error');
            });
        });
    };

    // prevent closing of dialog while we're triggering
    $scope.$on('modal.closing', function(event) {
        if ($scope.triggering) {
            event.preventDefault();
        }
    });

    let decisionTaskGUID = ThResultSetStore.getGeckoDecisionTaskGUID(repoName, resultsetId);
    if (decisionTaskGUID) {
        ThJobDetailModel.getJobDetails(
            { job_guid: decisionTaskGUID, title: 'artifact uploaded'},
            {timeout: null}).then(function(uploads) {
                let actionsUpload = uploads.find(
                    (upload) => upload.value === 'actions.json');
                if (!actionsUpload) {
                    alert("Could not find actions.json");
                    return;
                }
                return $http.get(actionsUpload.url).then(function(response) {
                    $scope.actions = response.data.actions;
                    $scope.input.selectedAction = $scope.actions[0];
                    $scope.updateSelectedAction();
                });
            });
    } else {
        alert("No decision task GUID, can't continue");
    }

});