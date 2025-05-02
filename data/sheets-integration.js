class GoogleSheetsIntegration {
    constructor(config) {
        this.SHEETS_URL = config.GOOGLE_SHEETS_URL;
        this.user = config.USER;
        this.failedRequestsKey = config.STORAGE_KEYS.FAILED_REQUESTS;
    }

    async sendData(data) {
        try {
            data.timestamp = DateUtils.getCurrentISTTime();
            data.user = this.user;
            
            const response = await fetch(this.SHEETS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: JSON.stringify(data)
            });

            console.log('Data sent to Google Sheets:', data);
            return true;
        } catch (error) {
            console.error('Error sending to Google Sheets:', error);
            this.storeFailedRequest(data);
            throw error;
        }
    }

    async getData(type = 'all') {
        try {
            const url = `${this.SHEETS_URL}?action=get&type=${type}`;
            const response = await fetch(url);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching from Google Sheets:', error);
            throw error;
        }
    }

    async downloadExcel(type = 'all') {
        try {
            const url = `${this.SHEETS_URL}?action=download&type=${type}`;
            const response = await fetch(url);
            const blob = await response.blob();
            
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `warehouse_data_${type}_${DateUtils.formatISTDateForFilename(new Date())}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('Error downloading Excel:', error);
            throw error;
        }
    }

    storeFailedRequest(data) {
        const failedRequests = JSON.parse(localStorage.getItem(this.failedRequestsKey) || '[]');
        failedRequests.push(data);
        localStorage.setItem(this.failedRequestsKey, JSON.stringify(failedRequests));
    }

    async retryFailedRequests() {
        const failedRequests = JSON.parse(localStorage.getItem(this.failedRequestsKey) || '[]');
        if (failedRequests.length > 0) {
            console.log(`Retrying ${failedRequests.length} failed requests`);
            localStorage.setItem(this.failedRequestsKey, '[]');
            
            for (const data of failedRequests) {
                try {
                    await this.sendData(data);
                } catch (error) {
                    console.error('Retry failed:', error);
                }
            }
        }
    }
}