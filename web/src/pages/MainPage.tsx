import React, { useCallback, useState } from 'react'
import { VersionResponse } from '../models/version'
import { getVersion } from '../services'
import { VersionBox } from '../components/VersionBox'
import { Col, Row } from 'react-bootstrap'

const MainPage: React.FC = () => {
  const [version, setVersion] = useState<VersionResponse>({ message: 'nothing yet' })

  const doGetVersion = useCallback(async () => {
    const [status, response] = await getVersion<VersionResponse>();
    if (status === 'success')
      setVersion(response);
  }, [setVersion])

  const bibl = {
    "neevel": "https://www.researchgate.net/publication/341822346_Bathophenanthroline_Indicator_Paper_Development_of_a_new_test_for_iron_ions",
    "wagner": "https://www.sciencedirect.com/science/article/abs/pii/S0039914020308110"
  }

  return <Row>
    <Col sm='5'>
      <img alt="Oak leaf with galls" src='/leaf.png' style={{ marginBottom: '10px' }} className='mx-auto d-block'></img>
      <VersionBox version={version} fetchVersion={doGetVersion} />
    </Col>
    <Col sm='1'></Col>
    <Col>
      <h4>tINKer</h4>
      <h5>Helper software for iron-tannin ink recognition</h5>
      <p>
        Analysis of ferro-tannin ink composition is crucial for identifying corrosion factors in old documents. It can as well
        be helpful in historical research. Quantitative elemental composition data obtained by various methods can be used
        to reliably identify an ink.
      </p>
      <p>The data gathered can come from
       an <abbr title="Laser Ablation Inductively Coupled Plasma Mass Spectrometry">LA-ICP-MS</abbr> device
       used on a bathophenanthroline paper indicators. These indicators, proposed by
       Neevel <a href={bibl.neevel}>(PapierRestaurierung Vol 6. (2005), No. 1)</a> allow for a non-invasive, simple to use and portable
       method of migrating ions from the ink.
      </p>
      <p>
        Further publications by Barbara Wagner and others <a href={bibl.wagner}>(Talanta Vol. 222, 15 Jan 2021)</a> describe using
        LA-ICP-MS on such indicators to gather high-precision elemental composition data. This data, coming from mass spectrometry output,
        needs to be processed and cleaned in order to obtain elemental composition proportions.
      </p>
      <p>
        Another source of data comes from using an <abbr title="X-ray fluorescence">XRF</abbr> device which provides
        direct information about elemental composition of an ink. Both methods provide output data that can be used to pair a sample to
        an ink among the set of previously analyzed ink recipes.
      </p>
      <p>
        The <strong>tINKer</strong> online tool helps with MS data preprocessing and provides a neural network for recognition of samples
        among the ink recipe database. A user can upload their sample data, store it, process and parametrize the data conversion. Approximated ink
        elemental composition can be then put through the recognition engine and paired with the most similar stored recipe.
      </p>
    </Col>
  </Row>;
}
export default MainPage;
