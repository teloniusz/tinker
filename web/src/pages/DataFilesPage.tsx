import { useState } from "react";
import { Button, Col, Container, Modal, Row } from "react-bootstrap";
import { UploadModal } from "../components/FileModals";
import { DataFilesBox } from "../components/DataFilesBox";

const DataFilesPage: React.FC = () => {
    const [showUpload, setShowUpload] = useState(false)

    return <>
        <Modal show={!!showUpload} onHide={() => setShowUpload(false)}>
            <UploadModal {...{ showUpload, setShowUpload }} />
        </Modal>
        <Container>
        <Row>
            <Col></Col>
            <Col md={12}>
                <h4>Browse data files</h4>
                <DataFilesBox/>
                <Button onClick={() => setShowUpload(true)}>Upload a file</Button>
            </Col>
            <Col></Col>
        </Row>
        </Container>
    </>
}

export default DataFilesPage;