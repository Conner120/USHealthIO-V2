import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Switch} from "@/components/ui/switch";

export default function page() {
    return (
        <main className="flex-1">
            <div className="space-y-6 px-8 py-6">
                <div>
                    <h2 className="text-2xl font-bold">Notification</h2>
                    <p className="text-muted-foreground">Manage how you receive notifications</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Email Notifications</CardTitle>
                        <CardDescription>Choose which emails you want to receive</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Marketing emails</p>
                                <p className="text-sm text-muted-foreground">Receive updates about new features</p>
                            </div>
                            <Switch/>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Security alerts</p>
                                <p className="text-sm text-muted-foreground">Get notified of suspicious activity</p>
                            </div>
                            <Switch defaultChecked/>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Weekly digest</p>
                                <p className="text-sm text-muted-foreground">Receive a summary of your activity</p>
                            </div>
                            <Switch defaultChecked/>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
    )
}