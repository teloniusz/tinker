import { useParams } from 'react-router-dom';
import { Container } from 'react-bootstrap';

export default function InksnetPage() {
    const { id } = useParams<{ id: string }>();

    return (
        <Container className="mt-4">
            <h2>InksNet Prediction</h2>
            <p>This is a stub for InksNet prediction for dataset ID: {id}</p>
        </Container>
    );
}
