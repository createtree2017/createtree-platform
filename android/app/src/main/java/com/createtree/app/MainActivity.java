package com.createtree.app;

import android.app.AlertDialog;
import android.os.Bundle;
import android.util.Log;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;

import com.getcapacitor.BridgeActivity;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "CreateTreeUpdate";

    private AppUpdateManager appUpdateManager;
    private ActivityResultLauncher<IntentSenderRequest> updateLauncher;
    private boolean mandatoryUpdateDialogShowing = false;
    private boolean immediateUpdateStarting = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getBridge().getWebView().addJavascriptInterface(
            new AndroidGalleryBridge(this),
            "CreateTreeAndroid"
        );

        setupMandatoryInAppUpdates();
    }

    @Override
    public void onResume() {
        super.onResume();
        resumeMandatoryUpdateIfNeeded();
    }

    private void setupMandatoryInAppUpdates() {
        appUpdateManager = AppUpdateManagerFactory.create(this);
        updateLauncher = registerForActivityResult(
            new ActivityResultContracts.StartIntentSenderForResult(),
            result -> {
                immediateUpdateStarting = false;
                if (result.getResultCode() != RESULT_OK) {
                    Log.w(TAG, "Mandatory update was canceled or failed: " + result.getResultCode());
                    showMandatoryUpdateRetryDialog();
                }
            }
        );

        checkForMandatoryUpdate();
    }

    private void checkForMandatoryUpdate() {
        if (appUpdateManager == null) {
            return;
        }

        appUpdateManager
            .getAppUpdateInfo()
            .addOnSuccessListener(appUpdateInfo -> {
                if (isFinishing() || isDestroyed()) {
                    return;
                }

                if (appUpdateInfo.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                    startImmediateUpdate(appUpdateInfo);
                    return;
                }

                if (appUpdateInfo.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                    && appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
                    showMandatoryUpdateDialog(appUpdateInfo);
                }
            })
            .addOnFailureListener(error -> Log.w(TAG, "In-app update check failed", error));
    }

    private void resumeMandatoryUpdateIfNeeded() {
        if (appUpdateManager == null) {
            return;
        }

        appUpdateManager
            .getAppUpdateInfo()
            .addOnSuccessListener(appUpdateInfo -> {
                if (appUpdateInfo.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                    startImmediateUpdate(appUpdateInfo);
                }
            })
            .addOnFailureListener(error -> Log.w(TAG, "In-app update resume check failed", error));
    }

    private void showMandatoryUpdateDialog(AppUpdateInfo appUpdateInfo) {
        if (mandatoryUpdateDialogShowing || isFinishing() || isDestroyed()) {
            return;
        }

        mandatoryUpdateDialogShowing = true;
        new AlertDialog.Builder(this)
            .setTitle("앱 업데이트가 필요합니다")
            .setMessage("최신 버전으로 업데이트해야 앱을 사용할 수 있습니다.")
            .setPositiveButton("업데이트", (dialog, which) -> {
                mandatoryUpdateDialogShowing = false;
                startImmediateUpdate(appUpdateInfo);
            })
            .setCancelable(false)
            .show();
    }

    private void showMandatoryUpdateRetryDialog() {
        if (mandatoryUpdateDialogShowing || isFinishing() || isDestroyed()) {
            return;
        }

        mandatoryUpdateDialogShowing = true;
        new AlertDialog.Builder(this)
            .setTitle("업데이트가 필요합니다")
            .setMessage("업데이트를 완료해야 앱을 계속 사용할 수 있습니다.")
            .setPositiveButton("다시 업데이트", (dialog, which) -> {
                mandatoryUpdateDialogShowing = false;
                checkForMandatoryUpdate();
            })
            .setNegativeButton("앱 종료", (dialog, which) -> {
                mandatoryUpdateDialogShowing = false;
                finish();
            })
            .setCancelable(false)
            .show();
    }

    private void startImmediateUpdate(AppUpdateInfo appUpdateInfo) {
        if (immediateUpdateStarting || updateLauncher == null) {
            return;
        }

        immediateUpdateStarting = true;
        boolean started = appUpdateManager.startUpdateFlowForResult(
            appUpdateInfo,
            updateLauncher,
            AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build()
        );

        if (!started) {
            immediateUpdateStarting = false;
            Log.w(TAG, "Immediate update flow could not be started");
            showMandatoryUpdateRetryDialog();
        }
    }
}
