package datart.server.common;

import datart.server.base.transfer.model.DatachartTemplateModel;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InvalidClassException;
import java.io.ObjectOutputStream;
import java.io.Serializable;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SecureObjectInputStreamTest {

    @Test
    void shouldReadAllowedTransferModel() throws Exception {
        DatachartTemplateModel model = new DatachartTemplateModel();

        try (SecureObjectInputStream input = new SecureObjectInputStream(
                new ByteArrayInputStream(serialize(model)))) {
            assertTrue(input.readObject() instanceof DatachartTemplateModel);
        }
    }

    @Test
    void shouldRejectUnexpectedSerializableType() throws Exception {
        try (SecureObjectInputStream input = new SecureObjectInputStream(
                new ByteArrayInputStream(serialize(new UnexpectedType())))) {
            assertThrows(InvalidClassException.class, input::readObject);
        }
    }

    private byte[] serialize(Serializable value) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ObjectOutputStream objectOutput = new ObjectOutputStream(output)) {
            objectOutput.writeObject(value);
        }
        return output.toByteArray();
    }

    private static class UnexpectedType implements Serializable {
    }
}
