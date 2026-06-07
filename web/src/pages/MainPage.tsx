import React, { useCallback, useState } from 'react'
import { VersionResponse } from '../models/version'
import { getVersion } from '../services'
import { VersionBox } from '../components/VersionBox'
import { Col, Row } from 'react-bootstrap'

const MainPage: React.FC<{ baseUrl: string }> = ({ baseUrl }) => {
  const [version, setVersion] = useState<VersionResponse>({ message: 'nothing yet' })

  const doGetVersion = useCallback(async () => {
    const [status, response] = await getVersion<VersionResponse>();
    if (status === 'success')
      setVersion(response);
  }, [setVersion])

  const bibl = {
    "NeevelReissland2005": "https://www.tandfonline.com/doi/abs/10.1080/15632628.2005.12461825",
    "WagnerCzajka2021": "https://www.sciencedirect.com/science/article/abs/pii/S0039914020308110",
  }

  return <Row>
    <Col sm='5'>
      <img alt="Oak leaf with galls" src={`${baseUrl}/leaf.png`} style={{ marginBottom: '10px' }} className='mx-auto d-block'></img>
      <VersionBox version={version} fetchVersion={doGetVersion} />
    </Col>
    <Col sm='1'></Col>
    <Col>
<h4>tINKer</h4>
<h5>Studying historical manuscripts with AI</h5>
<p>
This web application supports the study of iron-gall inks from strictly
protected historical manuscripts.
</p>
<p>
Iron-gall ink was the most widely used ink in European history, employed
extensively for nearly 1,000 years. The methods of its preparation
varied greatly depending on the region, period, and other circumstances
surrounding the creation of a document. Consequently, the chemical
composition of an iron-gall ink can be a rich source of information for
scholars examining such objects. Typical components include iron and
copper salts, tannins, and gum arabic. The tannins were sometimes
derived from gall nuts, small growths formed by wasps on oak leaves (see
the logo).
</p>
<p>
According to the established conservation protocols, chemical
information from the inked surface of a historical document can be
transferred non-destructively to specially prepared indicator papers
soaked with bathophenanthroline (<a href={bibl.NeevelReissland2005}>Neevel and Reissland,
2005</a>).
The indicator papers can be then analysed by laser ablation inductively
coupled plasma mass spectrometry (LA-ICP-MS), which provides
multielemental information on indicator composition (<a href={bibl.WagnerCzajka2021}>Wagner and Czajka,
2021</a>).
Subsequent prediction using 
<a target="_blank" href="https://github.com/BDomzal/inks/tree/main">
<img alt="InksNet logo" src={`${baseUrl}/inksnet.svg`} style={{ width: 20, height: 20, margin: '0 2px 2px 3px' }}/>InksNet</a> enables
reconstructing information about the composition of the original ink.
</p>
<p>
The tINKer online tool helps with LA-ICP-MS data preprocessing and
prediction of ink composition by InksNet. A user can upload their sample
data, store it, process and parametrise the data conversion, run the
predicting algorithm and download the results.
</p>
<h5>Citation</h5>
<p>
Paper in preparation. Meanwhile, if you are using this tool,
please cite it using its URL.
</p>
<h5>Acknowledgements</h5>
<p>This work was supported by the Polish National Science Centre grants: Spectral Analysis of Legacy Inks using machiNe
leArning: ALiNA (2021/41/B/ST4/02860) and Optimal-transport based algorithms for Mass Spectrometry and NMR (2021/41/B/ST6/03526).</p>
<p>Funding for access to the Reference Material Collections of the Heritage Science Laboratory at the University of Ljubljana was provided through
I0-E012 (Slovenian Research and Innovation Agency).</p>
    </Col>
  </Row>;
}
export default MainPage;
