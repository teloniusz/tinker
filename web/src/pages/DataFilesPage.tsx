import { useState } from "react";
import { Button, Col, Container, Modal, Row } from "react-bootstrap";
import { UploadModal } from "../components/FileModals";
import { DataSetsTable } from "../components/DataFilesBox";

const DataSetsPage: React.FC = () => {
    const [showUpload, setShowUpload] = useState(false)
    const [reloadTable, setReloadTable] = useState(0); // add reload state

    const handleUploadSuccess = () => {
        setReloadTable(r => r + 1);
    };

    return <>
        <Modal show={!!showUpload} onHide={() => setShowUpload(false)}>
            <UploadModal {...{ setShowUpload }} onUploadSuccess={handleUploadSuccess}/>
        </Modal>
        <Container>
        <Row>
            <Col></Col>
            <Col md={12}>
                <h4>Browse data sets</h4>
                <DataSetsTable reloadKey={reloadTable}/> {/* pass reloadKey */}
                <Button onClick={() => setShowUpload(true)}>Upload a file</Button>
            </Col>
            <Col></Col>
        </Row>
        </Container>
    </>
}

export default DataSetsPage;