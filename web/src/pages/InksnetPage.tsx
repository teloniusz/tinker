import { useParams, useNavigate } from 'react-router-dom';
import { Container, Button, Table, Row, Col, Spinner } from 'react-bootstrap';
import { ReactNode, useEffect, useState } from 'react';
import { runPrediction, getPrefix } from '../services';
import { setAlert, useAppState } from '../AppState';
import { stringifyError } from '../models/network';


function ChartFrame({ title, children }: { title: string, children: ReactNode }) {
    return <div style={{ border: 'solid 1px #ccc', marginTop: '2em' }}>
        <h4 style={{
            marginLeft: '1.5em',
            background: '#fff'
        }}>
            <span style={{
                padding: '5px 10px',
                position: 'relative',
                background: '#fff',
                top: '-0.7em'
            }}>{ title }</span>
        </h4>
        {children}
    </div>
}


export default function InksnetPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [, dispatchState] = useAppState();
    const [loading, setLoading] = useState(false);
    const [prediction, setPrediction] = useState<{ label: string, prediction: Record<string, number[]> | null }>(
        { label: '', prediction: null });
    const [figs, setFigs] = useState<Record<string, string> | null>(null);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const resp = await runPrediction(parseInt(id, 10));
                if (!resp) {
                    setAlert(dispatchState, { type: 'error', text: 'No response from server' });
                    return;
                }
                if (resp.status === 'error') {
                    const msg = stringifyError(resp.error)
                    setAlert(dispatchState, { type: 'error', text: msg });
                    return;
                }
                const data = resp.data || resp;
                if (!data) {
                    setAlert(dispatchState, { type: 'error', text: 'Invalid response data' });
                    return;
                }
                setPrediction({ label: data.label, prediction: data.prediction });
                setFigs(data.figs || null);
            } catch (e: any) {
                const msg = e?.message || `${e}`;
                setAlert(dispatchState, { type: 'error', text: msg });
            } finally {
                if (!cancelled)
                    setLoading(false);
            }
        }
        run();
        return () => { cancelled = true; }
    }, [id, dispatchState]);

    const prefix = getPrefix();
    const figBase = (iid: string | undefined) => `${prefix}/api/datasets/prediction/${id}/figures/${iid}`;

    return (
        <Container className="mt-4">
            <Row className="mb-3 align-items-center">
                <Col xs="auto">
                    <Button variant="link" onClick={() => navigate('/datasets')} title="Back to datasets">
                        <i className="bi bi-arrow-left" style={{ fontSize: '1.2rem' }} />
                    </Button>
                </Col>
                <Col>
                    <h2>InksNet prediction{ prediction.label ? `: ${prediction.label}`: '' }</h2>
                </Col>
            </Row>

            {loading && <div><Spinner animation="border" /> Loading prediction...</div>}

            {!loading && prediction.prediction && (
                <>
                    <ChartFrame title="Prediction proportions">
                    <Table responsive striped bordered hover size="sm">
                        <thead>
                            <tr>
                                <th>Element</th>
                                <th colSpan={prediction.prediction['Fe'].length}>Estimations</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(prediction.prediction).map(([elem, val]: [string, number[]]) => (
                                <tr key={elem}>
                                    <td>{elem}</td>
                                    {val.map(el => <td>{Number(el).toFixed(2)}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                    </ChartFrame>
                </>
            )}

            {!loading && figs && (
                <>
                    <h2 className="mt-4">Figures</h2>
                    <Row>
                        <Col md={12} className="mb-3">
                            <ChartFrame title="PCA chart">
                            {figs.pca ? <img alt="PCA chart" src={figBase(figs.pca)} style={{ width: '100%' }} /> : <div className="text-muted">Not available</div>}
                            </ChartFrame>
                        </Col>
                    </Row><Row>
                        <Col md={12} className="mb-3">
                            <ChartFrame title="Means PCA chart">
                            {figs.means_pca ? <img alt="Means PCA chart" src={figBase(figs.means_pca)} style={{ width: '100%' }} /> : <div className="text-muted">Not available</div>}
                            </ChartFrame>
                        </Col>
                    </Row><Row>
                        <Col md={12} className="mb-3">
                            <ChartFrame title="Clustering heatmap chart">
                            {figs.heatmap ? <img alt="Clustering heatmap chart" src={figBase(figs.heatmap)} style={{ width: '100%' }} /> : <div className="text-muted">Not available</div>}
                            </ChartFrame>
                        </Col>
                    </Row>
                </>
            )}
        </Container>
    );
}
