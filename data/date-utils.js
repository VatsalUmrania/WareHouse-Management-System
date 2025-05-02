class DateUtils {
    static formatISTDate(date) {
        // Convert to IST by adding 5 hours and 30 minutes
        const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
        
        const pad = (num) => String(num).padStart(2, '0');
        
        const year = istDate.getUTCFullYear();
        const month = pad(istDate.getUTCMonth() + 1);
        const day = pad(istDate.getUTCDate());
        const hours = pad(istDate.getUTCHours());
        const minutes = pad(istDate.getUTCMinutes());
        const seconds = pad(istDate.getUTCSeconds());
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    static formatISTDateForFilename(date) {
        const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
        
        const pad = (num) => String(num).padStart(2, '0');
        
        const year = istDate.getUTCFullYear();
        const month = pad(istDate.getUTCMonth() + 1);
        const day = pad(istDate.getUTCDate());
        const hours = pad(istDate.getUTCHours());
        const minutes = pad(istDate.getUTCMinutes());
        
        return `${year}-${month}-${day}_${hours}-${minutes}`;
    }

    static getCurrentISTTime() {
        return this.formatISTDate(new Date());
    }
}