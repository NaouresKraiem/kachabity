import { Spin } from "antd";

// Shown instantly inside the admin layout (sidebar stays) while the next admin page loads.
export default function AdminLoading() {
    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
            <Spin size="large" />
        </div>
    );
}
