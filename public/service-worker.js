self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.openWindow(`${self.registration.scope}dashboard/timer`),
    );
});
